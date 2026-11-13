"""Admin router package shim."""

from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["admin"])

__all__ = ["router"]
