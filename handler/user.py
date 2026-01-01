from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from service.user import (
    login_service,
    password_modify_service,
    register_service,
    AuthError,
)
from middleware.auth import get_current_user, UserClaim

router = APIRouter()


class UserLoginRequest(BaseModel):
    """user login request"""

    username: str | None = None
    identifier: str | None = None
    password: str


class PasswordModifyRequest(BaseModel):
    """password modify request"""
    old_password: str
    new_password: str


class UserRegisterRequest(BaseModel):
    """user register request"""

    username: str | None = None
    password: str
    email: str


@router.post("/login", tags=["user"])
async def login(req: UserLoginRequest):
    """user login"""
    identifier = (req.identifier or req.username or "").strip()
    try:
        token = login_service(identifier, req.password)
    except AuthError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.status_code, "msg": exc.message},
        ) from exc
    return {"code": 200, "data": {"token": token}}


@router.post("/register", tags=["user"])
async def register(req: UserRegisterRequest):
    """user register"""
    try:
        register_service(req.username, req.password, req.email)
    except AuthError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.status_code, "msg": exc.message},
        ) from exc
    return {"code": 200, "msg": "register success"}


@router.post("/password/modify", tags=["user"])
async def password_modify(
    req: PasswordModifyRequest,
    current_user: UserClaim = Depends(get_current_user)
):
    """password modify"""
    try:
        password_modify_service(
            current_user.uuid,
            current_user.username,
            req.old_password,
            req.new_password
        )
    except AuthError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.status_code, "msg": exc.message},
        ) from exc
    return {"code": 200, "msg": "modify success"}

