from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Role, User

ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 8
bearer_scheme = HTTPBearer()


# ---- Passwords ----
def hash_password(plain: str) -> str:
    data = plain.encode("utf-8")
    if len(data) > 72:
        raise ValueError("Password must be at most 72 bytes")
    return bcrypt.hashpw(data, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    data = plain.encode("utf-8")
    if len(data) > 72:
        return False
    return bcrypt.checkpw(data, hashed.encode("utf-8"))


# ---- Tokens ----
def create_access_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


# ---- Dependencies used by every protected endpoint ----
def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    try:
        payload = jwt.decode(creds.credentials, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise unauthorized

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


def require_member(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.MEMBER:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Member access required")
    return user
