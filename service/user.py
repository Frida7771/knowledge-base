import re
import uuid
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import jwt
from starlette import status

from dao.user_basic_dao import (
    search_user_by_username,
    search_user_by_email,
    update_user,
)
from models.user_basic import UserBasicDao
from define import JWT_SECRET
from service.admin.user import create_service as admin_create_service

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AuthError(Exception):
    """Custom exception for authentication failures."""

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    verify password (support both new and old storage methods):
    - new: bcrypt hash
    - old: plain text (compatible with existing data)
    """
    # old data: plain text storage, directly compare
    if not hashed_password.startswith("$2b$") and not hashed_password.startswith("$2a$"):
        return plain_password == hashed_password

    # new data: bcrypt hash
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def _normalize_email(email: str) -> str:
    email = (email or "").strip().lower()
    if not email or not EMAIL_REGEX.match(email):
        raise AuthError("Invalid email address")
    return email


def _ensure_password_requirements(password: str) -> None:
    if len(password or "") < 8:
        raise AuthError("Password must be at least 8 characters long")


def _ensure_username_available(username: Optional[str]) -> str:
    base = (username or "").strip() or f"user-{uuid.uuid4().hex[:8]}"
    candidate = base
    suffix = 1
    while True:
        response = search_user_by_username(candidate)
        hits = response.get("hits", {}).get("total", {}).get("value", 0)
        if hits == 0:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


def login_service(username: str, password: str) -> str:
    """
    login service
    """
    identifier = (username or "").strip()
    if not identifier:
        raise AuthError("Username or email is required")

    response = search_user_by_username(identifier)
    hits = response.get("hits", {}).get("hits", [])

    if not hits and "@" in identifier:
        response = search_user_by_email(identifier)
        hits = response.get("hits", {}).get("hits", [])
    
    if not hits:
        if "@" in identifier:
            raise AuthError("Email is not registered", status.HTTP_404_NOT_FOUND)
        raise AuthError("Username not found", status.HTTP_404_NOT_FOUND)
    
    user_source = hits[0]["_source"]
    user_basic = UserBasicDao(**user_source)
    
    if not _verify_password(password, user_basic.password):
        raise AuthError("Password is incorrect", status.HTTP_401_UNAUTHORIZED)
    
    exp = datetime.utcnow() + timedelta(days=1)
    claim = {
        "uuid": user_basic.uuid,
        "username": user_basic.username,
        "email": user_basic.email,
        "exp": int(exp.timestamp())  # PyJWT uses seconds, not milliseconds
    }
    token = jwt.encode(claim, JWT_SECRET, algorithm="HS256")
    
    return token


def register_service(
    username: Optional[str], password: str, email: Optional[str]
) -> None:
    """
    ordinary user registration, reuse admin create logic (contains username uniqueness verification and password hash)
    """
    if not email:
        raise AuthError("Email is required")
    normalized_email = _normalize_email(email)
    _ensure_password_requirements(password)

    email_hits = search_user_by_email(normalized_email).get("hits", {}).get("hits", [])
    if email_hits:
        raise AuthError("Email already registered", status.HTTP_409_CONFLICT)

    target_username = _ensure_username_available(username or normalized_email.split("@")[0])

    success, error = admin_create_service(target_username, password, normalized_email)
    if not success:
        raise AuthError(error or "Register failed")


def password_modify_service(user_uuid: str, username: str, old_password: str, new_password: str) -> None:
    """
    modify password service
    返回: (success, error_message)
    """
    # 1. get user info
    response = search_user_by_username(username)
    
    hits = response.get("hits", {}).get("hits", [])
    if not hits:
        raise AuthError("User not found", status.HTTP_404_NOT_FOUND)
    
    user_id = hits[0]["_id"]
    user_source = hits[0]["_source"]
    user_basic = UserBasicDao(**user_source)
    
    # 2. verify user UUID
    if user_basic.uuid != user_uuid:
        raise AuthError("User info mismatch", status.HTTP_403_FORBIDDEN)
    
    # 3. verify old password (support both new and old storage methods)
    if not _verify_password(old_password, user_basic.password):
        raise AuthError("Old password is incorrect", status.HTTP_401_UNAUTHORIZED)

    _ensure_password_requirements(new_password)
    
    # 4. update password
    from datetime import datetime
    update_user(
        user_id,
        {
            # new password一律以哈希存储
            "password": bcrypt.hashpw(
                new_password.encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8"),
            "update_at": int(datetime.utcnow().timestamp() * 1000),
        },
    )
    
    return None

