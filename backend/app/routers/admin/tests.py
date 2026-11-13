from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/tests")
def list_tests():
    return {"items": []}
