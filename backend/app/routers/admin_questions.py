import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from pydantic import ValidationError
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Question, TestQuestion
from app.schemas_questions import QuestionIn, QuestionOut, QuestionPage

router = APIRouter(prefix="/admin/questions", tags=["admin-questions"])

MAX_CSV_BYTES = 2_000_000
CSV_FIELDS = ["text", "option_a", "option_b", "option_c", "option_d",
              "correct_option", "marks", "difficulty", "topic", "explanation"]
CSV_OPTIONAL = {"marks", "difficulty", "explanation"}

# Fields that cannot change once a question is used in a test.
PROTECTED = ["text", "option_a", "option_b", "option_c", "option_d", "correct_option", "marks"]


def used_question_ids(db: Session, ids: list[int]) -> set[int]:
    if not ids:
        return set()
    rows = (
        db.query(TestQuestion.question_id)
        .filter(TestQuestion.question_id.in_(ids))
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


def to_out(q: Question, used: set[int]) -> QuestionOut:
    return QuestionOut(
        id=q.id, text=q.text,
        option_a=q.option_a, option_b=q.option_b, option_c=q.option_c, option_d=q.option_d,
        correct_option=q.correct_option, marks=q.marks, difficulty=q.difficulty,
        topic=q.topic, explanation=q.explanation,
        locked=bool(q.is_locked) or q.id in used,
    )


def text_exists(db: Session, text: str, exclude_id: int | None = None) -> bool:
    q = db.query(Question.id).filter(func.lower(Question.text) == text.lower())
    if exclude_id is not None:
        q = q.filter(Question.id != exclude_id)
    return q.first() is not None


def first_error(e: ValidationError) -> str:
    err = e.errors()[0]
    field = ".".join(str(x) for x in err["loc"]) or "row"
    return f"{field}: {err['msg'].replace('Value error, ', '')}"


# NOTE: fixed paths (/topics, /upload-csv) are declared before /{question_id}.

@router.get("", response_model=QuestionPage)
def list_questions(
    search: str | None = None,
    topic: str | None = None,
    difficulty: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Question)
    if search and search.strip():
        q = q.filter(Question.text.ilike(f"%{search.strip()}%"))
    if topic:
        q = q.filter(Question.topic == topic)
    if difficulty:
        q = q.filter(Question.difficulty == difficulty)

    total = q.count()
    rows = q.order_by(Question.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    used = used_question_ids(db, [r.id for r in rows])
    return QuestionPage(total=total, items=[to_out(r, used) for r in rows])


@router.get("/topics", response_model=list[str])
def list_topics(db: Session = Depends(get_db)):
    rows = db.query(Question.topic).distinct().order_by(Question.topic).all()
    return [r[0] for r in rows]


@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
def add_question(data: QuestionIn, db: Session = Depends(get_db)):
    if text_exists(db, data.text):
        raise HTTPException(status.HTTP_409_CONFLICT, "A question with the same text already exists")
    q = Question(**data.model_dump(), is_locked=False)
    db.add(q)
    db.commit()
    db.refresh(q)
    return to_out(q, set())


@router.post("/upload-csv")
def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please upload a .csv file")

    raw = file.file.read(MAX_CSV_BYTES + 1)
    if len(raw) > MAX_CSV_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File is too large (max 2 MB)")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))
    headers = {h.strip().lower(): h for h in (reader.fieldnames or []) if h}
    missing = [f for f in CSV_FIELDS if f not in CSV_OPTIONAL and f not in headers]
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "CSV is missing these columns: " + ", ".join(missing),
        )

    existing = {t.lower() for (t,) in db.query(Question.text).all()}
    created = 0
    skipped = []
    errors = []

    for line_no, row in enumerate(reader, start=2):  # row 1 is the header
        payload = {}
        for field in CSV_FIELDS:
            val = row.get(headers[field]) if field in headers else None
            val = val.strip() if isinstance(val, str) else ""
            if field in CSV_OPTIONAL and not val:
                continue  # let the default apply
            payload[field] = val
        try:
            data = QuestionIn(**payload)
        except ValidationError as e:
            errors.append({"row": line_no, "reason": first_error(e)})
            continue

        key = data.text.lower()
        if key in existing:
            skipped.append({"row": line_no, "text": data.text[:80]})
            continue

        db.add(Question(**data.model_dump(), is_locked=False))
        existing.add(key)
        created += 1

    db.commit()
    return {"created": created, "skipped": skipped, "errors": errors}


@router.put("/{question_id}", response_model=QuestionOut)
def edit_question(question_id: int, data: QuestionIn, db: Session = Depends(get_db)):
    q = db.get(Question, question_id)
    if q is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")

    used = used_question_ids(db, [question_id])
    locked = bool(q.is_locked) or question_id in used
    if locked:
        changed = [f for f in PROTECTED if getattr(q, f) != getattr(data, f)]
        if changed:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "This question is already used in a test, so its text, options, correct answer "
                "and marks cannot be changed. You can still edit topic, difficulty and explanation. "
                "To fix a mistake, add a corrected copy as a new question.",
            )

    if text_exists(db, data.text, exclude_id=question_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "A question with the same text already exists")

    for field, value in data.model_dump().items():
        setattr(q, field, value)
    db.commit()
    db.refresh(q)
    return to_out(q, used)


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(question_id: int, db: Session = Depends(get_db)):
    q = db.get(Question, question_id)
    if q is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    if q.is_locked or question_id in used_question_ids(db, [question_id]):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This question is used in a test and cannot be deleted.",
        )
    db.delete(q)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
