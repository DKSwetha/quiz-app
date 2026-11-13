from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/members")
def list_members():
    return {"items": []}
