from pydantic import BaseModel, Field, field_validator, model_validator

DIFFICULTIES = ("easy", "medium", "hard")


class QuestionIn(BaseModel):
    text: str = Field(max_length=2000)
    option_a: str = Field(max_length=500)
    option_b: str = Field(max_length=500)
    option_c: str = Field(max_length=500)
    option_d: str = Field(max_length=500)
    correct_option: str
    marks: int = Field(default=1, ge=1, le=100)
    difficulty: str = "medium"
    topic: str = Field(max_length=100)
    explanation: str | None = Field(default=None, max_length=2000)

    @field_validator("text", "option_a", "option_b", "option_c", "option_d", "topic")
    @classmethod
    def not_blank(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("cannot be empty")
        return v

    @field_validator("correct_option")
    @classmethod
    def check_correct(cls, v):
        v = v.strip().upper()
        if v not in ("A", "B", "C", "D"):
            raise ValueError("must be A, B, C or D")
        return v

    @field_validator("difficulty")
    @classmethod
    def check_difficulty(cls, v):
        v = v.strip().lower()
        if v not in DIFFICULTIES:
            raise ValueError("must be easy, medium or hard")
        return v

    @field_validator("explanation")
    @classmethod
    def clean_explanation(cls, v):
        if v is None:
            return None
        v = v.strip()
        return v or None

    @model_validator(mode="after")
    def options_distinct(self):
        opts = [o.lower() for o in (self.option_a, self.option_b, self.option_c, self.option_d)]
        if len(set(opts)) < 4:
            raise ValueError("All four options must be different")
        return self


class QuestionOut(BaseModel):
    id: int
    text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    marks: int
    difficulty: str
    topic: str
    explanation: str | None
    locked: bool


class QuestionPage(BaseModel):
    total: int
    items: list[QuestionOut]
