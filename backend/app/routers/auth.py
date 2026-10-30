from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, verify_password
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.strip().lower()).first()

    if user is None or (user.password_hash and not verify_password(data.password, user.password_hash)):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.password_hash:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Password not set yet. Use the link in your invite email.",
        )
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")

    return TokenResponse(access_token=create_access_token(user), role=user.role, name=user.name)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
