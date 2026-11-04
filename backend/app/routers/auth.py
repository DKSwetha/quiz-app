from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import verify_password, hash_password
from app.database import get_db
from app.models import User, Role
from app.schemas import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse

from sqlalchemy.exc import IntegrityError

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.strip().lower()).first()

    if user is None or not user.password_hash:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")

    return LoginResponse(
        message="Login successful",
        user_id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
    )


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED
)
def register(data: RegisterRequest, db: Session = Depends(get_db)):

    # 1. Normalize email
    email = data.email.strip().lower()

    # 2. Check whether email already exists
    existing_user = db.query(User).filter(
        User.email == email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    # 3. Hash the password
    hashed_password = hash_password(data.password)

    # 4. Create member object
    new_user = User(
        name=data.name.strip(),
        email=email,
        password_hash=hashed_password,
        role=Role.MEMBER,
        is_active=True
    )

    # 5. Save to PostgreSQL
    db.add(new_user)

    try:
        db.commit()

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    db.refresh(new_user)

    # 6. Return response
    return RegisterResponse(
        message="Registration successful",
        user_id=new_user.id,
        name=new_user.name,
        email=new_user.email,
        role=new_user.role
    )