import uuid
from datetime import datetime
from typing import Optional

import bcrypt

from dao.user_basic_dao import (
    search_user_by_username,
    search_user_by_uuid,
    create_user,
    update_user,
    list_users,
)
from models.user_basic import UserBasicDao


def _hash_password(plain_password: str) -> str:
    """
    hash password using bcrypt
    """
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode(
        "utf-8"
    )


def create_service(username: str, password: str, email: Optional[str] = None) -> tuple[bool, Optional[str]]:
    """
    create user service
    返回: (success, error_message)
    """
    # 1. check if username exists
    response = search_user_by_username(username)
    total = response.get("hits", {}).get("total", {}).get("value", 0)
    if total > 0:
        return False, "username already exists"
    
    # 2. create user (hash password)
    now = int(datetime.utcnow().timestamp() * 1000)
    user = UserBasicDao(
        uuid=str(uuid.uuid4()),
        username=username,
        password=_hash_password(password),
        email=email,
        create_at=now,
        update_at=now
    )
    create_user(user)
    
    return True, None


def reset_password_service(user_uuid: str, password: str) -> tuple[bool, Optional[str]]:
    """
    reset password service
    return: (success, error_message)
    """
    # 1. get user info
    response = search_user_by_uuid(user_uuid)
    
    hits = response.get("hits", {}).get("hits", [])
    if not hits:
        return False, "get user info failed"
    
    user_id = hits[0]["_id"]
    
    # 2. update password (hash password)
    update_user(user_id, {
        "password": _hash_password(password),
        "update_at": int(datetime.utcnow().timestamp() * 1000)
    })
    
    return True, None


def list_service(page: int, size: int) -> tuple[Optional[dict], Optional[str]]:
    """
    get user list service
    return: (result, error_message)
    """
    try:
        response = list_users(page, size)
        
        total = response.get("hits", {}).get("total", {}).get("value", 0)
        hits = response.get("hits", {}).get("hits", [])
        
        user_list = []
        for hit in hits:
            user_source = hit["_source"]
            user_basic = UserBasicDao(**user_source)
            user_list.append(user_basic.dict())
        
        return {
            "list": user_list,
            "total": total
        }, None
    except Exception as e:
        return None, str(e)

