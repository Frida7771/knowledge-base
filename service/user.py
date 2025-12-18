from jose import jwt

from datetime import datetime, timedelta
from typing import Optional

import bcrypt

from dao.user_basic_dao import search_user_by_username, update_user
from models.user_basic import UserBasicDao
from define import JWT_SECRET
from service.admin.user import create_service as admin_create_service


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


def login_service(username: str, password: str) -> tuple[Optional[str], Optional[str]]:
    """
    login service
    return: (token, error_message)
    """
    # 1. get user info
    response = search_user_by_username(username)
    
    hits = response.get("hits", {}).get("hits", [])
    if not hits:
        return None, "username not found"
    
    # 2. parse user data
    user_source = hits[0]["_source"]
    user_basic = UserBasicDao(**user_source)
    
    # 3. verify password (support both new and old storage methods)
    if not _verify_password(password, user_basic.password):
        return None, "password is incorrect"
    
    # 4. generate token
    exp = datetime.utcnow() + timedelta(days=1)
    claim = {
        "uuid": user_basic.uuid,
        "username": user_basic.username,
        "email": user_basic.email,
        "exp": int(exp.timestamp())  # PyJWT uses seconds, not milliseconds
    }
    token = jwt.encode(claim, JWT_SECRET, algorithm="HS256")
    
    return token, None


def register_service(
    username: str, password: str, email: Optional[str]
) -> tuple[bool, Optional[str]]:
    """
    ordinary user registration, reuse admin create logic (contains username uniqueness verification and password hash)
    """
    return admin_create_service(username, password, email)


def password_modify_service(user_uuid: str, username: str, old_password: str, new_password: str) -> tuple[bool, Optional[str]]:
    """
    modify password service
    返回: (success, error_message)
    """
    # 1. get user info
    response = search_user_by_username(username)
    
    hits = response.get("hits", {}).get("hits", [])
    if not hits:
        return False, "username not found"
    
    user_id = hits[0]["_id"]
    user_source = hits[0]["_source"]
    user_basic = UserBasicDao(**user_source)
    
    # 2. verify user UUID
    if user_basic.uuid != user_uuid:
        return False, "user info mismatch"
    
    # 3. verify old password (support both new and old storage methods)
    if not _verify_password(old_password, user_basic.password):
        return False, "old password is incorrect"
    
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
    
    return True, None

