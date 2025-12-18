from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from jose import jwt
from define import JWT_SECRET

security = HTTPBearer()


class UserClaim(BaseModel):
    """user claim"""
    uuid: str
    username: str
    email: Optional[str] = None
    exp: int


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserClaim:
    """
    get current user (JWT authentication middleware)
    """
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_claim = UserClaim(**payload)
        return user_claim
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "msg": "token expired"}
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "msg": "token is invalid"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "msg": f"token verification failed: {str(e)}"}
        )

