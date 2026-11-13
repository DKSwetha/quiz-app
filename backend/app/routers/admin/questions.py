from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/questions")
def list_questions():
    return {"items": []}
