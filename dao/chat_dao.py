from typing import Dict, Any, List

from elasticsearch import Elasticsearch

from dao.init import get_es_client
from models.chat import CHAT_INDEX, CHAT_MESSAGE_INDEX


def _ensure_indices(client: Elasticsearch) -> None:
    """ensure Chat related indices exist"""
    if not client.indices.exists(index=CHAT_INDEX):
        client.indices.create(
            index=CHAT_INDEX,
            mappings={
                "properties": {
                    "uuid": {"type": "keyword"},
                    "kb_uuid": {"type": "keyword"},
                    "title": {"type": "text"},
                    "user_uuid": {"type": "keyword"},
                    "create_at": {"type": "long"},
                    "update_at": {"type": "long"},
                }
            },
        )

    if not client.indices.exists(index=CHAT_MESSAGE_INDEX):
        client.indices.create(
            index=CHAT_MESSAGE_INDEX,
            mappings={
                "properties": {
                    "uuid": {"type": "keyword"},
                    "chat_uuid": {"type": "keyword"},
                    "role": {"type": "keyword"},
                    "content": {"type": "text"},
                    "create_at": {"type": "long"},
                }
            },
        )


def create_chat(doc: Dict[str, Any]) -> None:
    client = get_es_client()
    _ensure_indices(client)
    client.index(index=CHAT_INDEX, document=doc)


def update_chat(uuid: str, fields: Dict[str, Any]) -> None:
    client = get_es_client()
    _ensure_indices(client)
    res = client.search(index=CHAT_INDEX, query={"term": {"uuid": uuid}})
    hits = res.get("hits", {}).get("hits", [])
    if not hits:
        return
    _id = hits[0]["_id"]
    client.update(index=CHAT_INDEX, id=_id, doc=fields)


def get_chat(uuid: str) -> Dict[str, Any] | None:
    client = get_es_client()
    _ensure_indices(client)
    res = client.search(index=CHAT_INDEX, query={"term": {"uuid": uuid}})
    hits = res.get("hits", {}).get("hits", [])
    if not hits:
        return None
    return hits[0]["_source"]


def list_chats(user_uuid: str, page: int, size: int) -> Dict[str, Any]:
    client = get_es_client()
    _ensure_indices(client)
    res = client.search(
        index=CHAT_INDEX,
        from_=(page - 1) * size,
        size=size,
        sort=[{"update_at": {"order": "desc"}}],
        query={"term": {"user_uuid": user_uuid}},
    )
    total = res.get("hits", {}).get("total", {}).get("value", 0)
    items = [hit["_source"] for hit in res.get("hits", {}).get("hits", [])]
    return {"total": total, "list": items}


def delete_chat(uuid: str) -> None:
    client = get_es_client()
    _ensure_indices(client)
    res = client.search(index=CHAT_INDEX, query={"term": {"uuid": uuid}})
    hits = res.get("hits", {}).get("hits", [])
    for hit in hits:
        client.delete(index=CHAT_INDEX, id=hit["_id"])
    # delete messages
    client.delete_by_query(
        index=CHAT_MESSAGE_INDEX,
        body={"query": {"term": {"chat_uuid": uuid}}},
    )


def append_message(doc: Dict[str, Any]) -> None:
    client = get_es_client()
    _ensure_indices(client)
    client.index(index=CHAT_MESSAGE_INDEX, document=doc)


def list_messages(chat_uuid: str, limit: int = 50) -> List[Dict[str, Any]]:
    client = get_es_client()
    _ensure_indices(client)
    res = client.search(
        index=CHAT_MESSAGE_INDEX,
        size=limit,
        sort=[{"create_at": {"order": "asc"}}],
        query={"term": {"chat_uuid": chat_uuid}},
    )
    hits = res.get("hits", {}).get("hits", [])
    return [hit["_source"] for hit in hits]




