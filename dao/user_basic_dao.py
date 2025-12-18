from elasticsearch import Elasticsearch
from dao.init import get_es_client
from models.user_basic import UserBasicDao, USER_BASIC_DAO_INDEX


def _ensure_indices(client: Elasticsearch) -> None:
    """make sure user index is created"""
    if not client.indices.exists(index=USER_BASIC_DAO_INDEX):
        client.indices.create(
            index=USER_BASIC_DAO_INDEX,
            mappings={
                "properties": {
                    "uuid": {"type": "keyword"},
                    "username": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                    "password": {"type": "keyword"},
                    "email": {"type": "keyword"},
                    "create_at": {"type": "long"},
                    "update_at": {"type": "long"},
                }
            },
        )


def search_user_by_username(username: str) -> dict:
    """search user by username"""
    client = get_es_client()
    _ensure_indices(client)
    response = client.search(
        index=USER_BASIC_DAO_INDEX,
        query={
            "term": {
                "username.keyword": username
            }
        }
    )
    return response


def search_user_by_uuid(uuid: str) -> dict:
    """search user by uuid"""
    client = get_es_client()
    _ensure_indices(client)
    response = client.search(
        index=USER_BASIC_DAO_INDEX,
        query={
            "term": {
                "uuid.keyword": uuid
            }
        }
    )
    return response


def create_user(user: UserBasicDao) -> dict:
    """create user"""
    client = get_es_client()
    _ensure_indices(client)
    response = client.index(
        index=USER_BASIC_DAO_INDEX,
        document=user.dict()
    )
    return response


def update_user(user_id: str, update_data: dict) -> dict:
    """update user"""
    client = get_es_client()
    _ensure_indices(client)
    response = client.update(
        index=USER_BASIC_DAO_INDEX,
        id=user_id,
        doc=update_data
    )
    return response


def list_users(page: int, size: int) -> dict:
    """list users"""
    client = get_es_client()
    _ensure_indices(client)
    response = client.search(
        index=USER_BASIC_DAO_INDEX,
        size=size,
        from_=(page - 1) * size,
        sort=[
            {
                "create_at": {
                    "order": "desc"
                }
            }
        ],
        query={
            "match_all": {}
        }
    )
    return response

