from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional
from service.admin.user import create_service, reset_password_service, list_service
from middleware.auth import get_current_user, UserClaim

router = APIRouter()


class UserCreateRequest(BaseModel):
    """create user request"""
    username: str
    password: str
    email: Optional[str] = None


class UserResetPasswordRequest(BaseModel):
    """reset password request"""
    uuid: str
    password: str


@router.post("/user/create", tags=["admin-user"])
async def create(
    req: UserCreateRequest,
    current_user: UserClaim = Depends(get_current_user)
):
    """create user"""
    success, error = create_service(req.username, req.password, req.email)
    if error:
        return {"code": -1, "msg": error}
    return {"code": 200, "msg": "create success"}


@router.post("/user/reset/password", tags=["admin-user"])
async def reset_password(
    req: UserResetPasswordRequest,
    current_user: UserClaim = Depends(get_current_user)
):
    """reset password"""
    success, error = reset_password_service(req.uuid, req.password)
    if error:
        return {"code": -1, "msg": error}
    return {"code": 200, "msg": "reset success"}


@router.get("/user/list", tags=["admin-user"])
async def list(
    page: int = Query(1, description="current page"),
    size: int = Query(10, description="data per page"),
    current_user: UserClaim = Depends(get_current_user)
):
    """user list"""
    result, error = list_service(page, size)
    if error:
        return {"code": -1, "msg": error}
    return {"code": 200, "data": result}

