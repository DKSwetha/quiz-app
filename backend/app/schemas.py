from pydantic import BaseModel, Field, field_validator


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    message: str
    user_id: int
    name: str
    email: str
    role: str
    access_token: str | None = None
    token_type: str = "bearer"

class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str
    password: str = Field(min_length=8)

    @field_validator("email")
    @classmethod
    def check_email(cls, v):
        v = v.strip().lower()

        if len(v) > 255 or "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email address")

        return v

    @field_validator("password")
    @classmethod
    def check_password_bytes(cls, v):
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must not exceed 72 bytes")

        return v


class RegisterResponse(BaseModel):
    message: str
    user_id: int
    name: str
    email: str
    role: str
    access_token: str | None = None
    token_type: str = "bearer"
