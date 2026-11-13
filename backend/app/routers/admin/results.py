from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/results")
def list_results():
    return {"items": []}
