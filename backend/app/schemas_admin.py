from pydantic import BaseModel, Field, field_validator


def _clean_email(v: str) -> str:
    v = v.strip().lower()
    if len(v) > 255 or "@" not in v or "." not in v.split("@")[-1] or " " in v:
        raise ValueError("Invalid email address")
    return v


def _clean_batch(v):
    if v is None:
        return None
    v = v.strip()
    return v or None


class MemberCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str
    batch: str | None = Field(default=None, max_length=100)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name is too short")
        return v

    @field_validator("email")
    @classmethod
    def clean_email(cls, v):
        return _clean_email(v)

    @field_validator("batch")
    @classmethod
    def clean_batch(cls, v):
        return _clean_batch(v)


class MemberUpdate(MemberCreate):
    pass


class ActiveToggle(BaseModel):
    is_active: bool


class MemberOut(BaseModel):
    id: int
    name: str
    email: str
    batch: str | None
    is_active: bool
    password_set: bool
