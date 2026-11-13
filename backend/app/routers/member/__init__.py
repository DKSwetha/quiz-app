"""Member router package shim."""

from fastapi import APIRouter

router = APIRouter(prefix="/members", tags=["members"])

__all__ = ["router"]
