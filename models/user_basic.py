from pydantic import BaseModel
from typing import Optional


class UserBasicDao(BaseModel):
    """user basic data model"""
    uuid: str
    username: str
    password: str
    email: Optional[str] = None
    create_at: int
    update_at: int

    class Config:
        json_schema_extra = {
            "example": {
                "uuid": "123e4567-e89b-12d3-a456-426614174000",
                "username": "testuser",
                "password": "password123",
                "email": "test@example.com",
                "create_at": 1640000000000,
                "update_at": 1640000000000
            }
        }


USER_BASIC_DAO_INDEX = "user_basic_dao"

