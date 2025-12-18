from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from service.user import login_service, password_modify_service, register_service
from middleware.auth import get_current_user, UserClaim

router = APIRouter()


class UserLoginRequest(BaseModel):
    """user login request"""
    username: str
    password: str


class PasswordModifyRequest(BaseModel):
    """password modify request"""
    old_password: str
    new_password: str


class UserRegisterRequest(BaseModel):
    """user register request"""
    username: str
    password: str
    email: str | None = None


@router.post("/login", tags=["user"])
async def login(req: UserLoginRequest):
    """user login"""
    token, error = login_service(req.username, req.password)
    if error:
        return {"code": -1, "msg": error}
    return {"code": 200, "data": {"token": token}}


@router.post("/register", tags=["user"])
async def register(req: UserRegisterRequest):
    """user register"""
    success, error = register_service(req.username, req.password, req.email)
    if error or not success:
        return {"code": -1, "msg": error or "register failed"}
    return {"code": 200, "msg": "register success"}


@router.post("/password/modify", tags=["user"])
async def password_modify(
    req: PasswordModifyRequest,
    current_user: UserClaim = Depends(get_current_user)
):
    """password modify"""
    success, error = password_modify_service(
        current_user.uuid,
        current_user.username,
        req.old_password,
        req.new_password
    )
    if error:
        return {"code": -1, "msg": error}
    return {"code": 200, "msg": "modify success"}

