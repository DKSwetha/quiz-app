from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/assignments")
def list_assignments():
    return {"items": []}
