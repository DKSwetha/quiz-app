from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    message: str
    user_id: int
    name: str
    email: str
    role: str

# Member registration
class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str
    password: str = Field(min_length=8)


class RegisterResponse(BaseModel):
    message: str
    user_id: int
    name: str
    email: str
    role: str
