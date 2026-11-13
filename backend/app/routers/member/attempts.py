from fastapi import APIRouter

router = APIRouter(prefix="/members", tags=["members"])


@router.get("/{user_id}/attempts")
def list_attempts(user_id: int):
    return {"user_id": user_id, "items": []}
