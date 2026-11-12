import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import ValidationError
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Role, User
from app.schemas_admin import ActiveToggle, MemberCreate, MemberOut, MemberUpdate

router = APIRouter(prefix="/admin/members", tags=["admin-members"])

MAX_CSV_BYTES = 1_000_000


def to_out(u: User) -> MemberOut:
    return MemberOut(
        id=u.id,
        name=u.name,
        email=u.email,
        batch=u.batch,
        is_active=u.is_active,
        password_set=bool(u.password_hash),
    )


def get_member_or_404(db: Session, member_id: int) -> User:
    user = db.get(User, member_id)
    if user is None or user.role != Role.MEMBER:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    return user


# NOTE: fixed paths (/batches, /upload-csv) are declared before /{member_id}.

@router.get("", response_model=list[MemberOut])
def list_members(
    search: str | None = None,
    batch: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
):
    q = db.query(User).filter(User.role == Role.MEMBER)
    if search and search.strip():
        like = f"%{search.strip()}%"
        q = q.filter(or_(User.name.ilike(like), User.email.ilike(like)))
    if batch:
        q = q.filter(User.batch == batch)
    if status_filter == "active":
        q = q.filter(User.is_active.is_(True))
    elif status_filter == "inactive":
        q = q.filter(User.is_active.is_(False))
    return [to_out(u) for u in q.order_by(User.name).all()]


@router.get("/batches", response_model=list[str])
def list_batches(db: Session = Depends(get_db)):
    rows = (
        db.query(User.batch)
        .filter(User.role == Role.MEMBER, User.batch.isnot(None))
        .distinct()
        .order_by(User.batch)
        .all()
    )
    return [r[0] for r in rows]


@router.post("", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def add_member(data: MemberCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")

    user = User(name=data.name, email=data.email, batch=data.batch, role=Role.MEMBER, is_active=True)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")
    db.refresh(user)
    return to_out(user)


@router.post("/upload-csv")
def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please upload a .csv file")

    raw = file.file.read(MAX_CSV_BYTES + 1)
    if len(raw) > MAX_CSV_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File is too large (max 1 MB)")
    try:
        text = raw.decode("utf-8-sig")  # utf-8-sig also handles Excel's hidden BOM
    except UnicodeDecodeError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))
    headers = {h.strip().lower(): h for h in (reader.fieldnames or []) if h}
    if "name" not in headers or "email" not in headers:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "CSV must have the columns: name, email, batch (batch is optional)",
        )

    existing = {row[0] for row in db.query(User.email).all()}
    created = 0
    skipped = []
    errors = []

    for line_no, row in enumerate(reader, start=2):  # row 1 is the header
        try:
            m = MemberCreate(
                name=row.get(headers["name"]) or "",
                email=row.get(headers["email"]) or "",
                batch=row.get(headers["batch"]) if "batch" in headers else None,
            )
        except ValidationError:
            errors.append({"row": line_no, "reason": "Invalid name or email"})
            continue

        if m.email in existing:
            skipped.append({"row": line_no, "email": m.email})
            continue

        db.add(User(name=m.name, email=m.email, batch=m.batch, role=Role.MEMBER, is_active=True))
        existing.add(m.email)
        created += 1

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Upload failed: a duplicate email was found. Please try again.")

    return {"created": created, "skipped": skipped, "errors": errors}


@router.put("/{member_id}", response_model=MemberOut)
def edit_member(member_id: int, data: MemberUpdate, db: Session = Depends(get_db)):
    user = get_member_or_404(db, member_id)

    if data.email != user.email:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")

    user.name = data.name
    user.email = data.email
    user.batch = data.batch
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")
    db.refresh(user)
    return to_out(user)


@router.patch("/{member_id}/active", response_model=MemberOut)
def set_active(member_id: int, data: ActiveToggle, db: Session = Depends(get_db)):
    user = get_member_or_404(db, member_id)
    user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    return to_out(user)
