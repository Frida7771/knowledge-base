from typing import List, Dict, Any, Optional

from elasticsearch import Elasticsearch

from dao.init import get_es_client
from models.kb import KB_INDEX, KB_DOC_INDEX, KB_DOC_EMBED_INDEX


def _ensure_indices(client: Elasticsearch) -> None:
    """
    make sure kb index is created.
    use loose mapping, suitable for beginner scenarios.
    """
    # kb index
    if not client.indices.exists(index=KB_INDEX):
        client.indices.create(
            index=KB_INDEX,
            mappings={
                "properties": {
                    "uuid": {"type": "keyword"},
                    "name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                    "description": {"type": "text"},
                    "create_at": {"type": "long"},
                    "update_at": {"type": "long"},
                }
            },
        )

    # doc index
    if not client.indices.exists(index=KB_DOC_INDEX):
        client.indices.create(
            index=KB_DOC_INDEX,
            mappings={
                "properties": {
                    "uuid": {"type": "keyword"},
                    "kb_uuid": {"type": "keyword"},
                    "title": {"type": "text"},
                    "content": {"type": "text"},
                    "create_at": {"type": "long"},
                    "update_at": {"type": "long"},
                }
            },
        )

    # vector index (store embeddings for server-side similarity)
    if not client.indices.exists(index=KB_DOC_EMBED_INDEX):
        client.indices.create(
            index=KB_DOC_EMBED_INDEX,
            mappings={
                "properties": {
                    "uuid": {"type": "keyword"},
                    "kb_uuid": {"type": "keyword"},
                    "doc_uuid": {"type": "keyword"},
                    "chunk": {"type": "text"},
                    "embedding": {
                        "type": "dense_vector",
                        "dims": 1536,
                    },
                    "create_at": {"type": "long"},
                }
            },
        )


# ==== kb ====


def create_kb(doc: Dict[str, Any]) -> None:
    client = get_es_client()
    _ensure_indices(client)
    client.index(index=KB_INDEX, document=doc)


def update_kb(uuid: str, fields: Dict[str, Any], owner_uuid: Optional[str] = None) -> None:
    client = get_es_client()
    _ensure_indices(client)
    # get _id and then update
    query: Dict[str, Any] = {"term": {"uuid": uuid}}
    if owner_uuid:
        query = {
            "bool": {
                "filter": [
                    {"term": {"uuid": uuid}},
                    {"term": {"owner_uuid.keyword": owner_uuid}},
                ]
            }
        }
    res = client.search(index=KB_INDEX, query=query)
    hits = res.get("hits", {}).get("hits", [])
    if not hits:
        return
    kb_id = hits[0]["_id"]
    client.update(index=KB_INDEX, id=kb_id, doc=fields)


def delete_kb(uuid: str) -> None:
    client = get_es_client()
    _ensure_indices(client)
    # delete kb itself
    res = client.search(index=KB_INDEX, query={"term": {"uuid": uuid}})
    hits = res.get("hits", {}).get("hits", [])
    for hit in hits:
        client.delete(index=KB_INDEX, id=hit["_id"])

    # cascade delete doc and vector
    client.delete_by_query(index=KB_DOC_INDEX, body={"query": {"term": {"kb_uuid": uuid}}})
    client.delete_by_query(index=KB_DOC_EMBED_INDEX, body={"query": {"term": {"kb_uuid": uuid}}})


def list_kb(page: int, size: int, owner_uuid: str) -> Dict[str, Any]:
    client = get_es_client()
    _ensure_indices(client)
    res = client.search(
        index=KB_INDEX,
        from_=(page - 1) * size,
        size=size,
        sort=[{"create_at": {"order": "desc"}}],
        query={"term": {"owner_uuid.keyword": owner_uuid}},
    )
    total = res.get("hits", {}).get("total", {}).get("value", 0)
    items = [hit["_source"] for hit in res.get("hits", {}).get("hits", [])]
    return {"total": total, "list": items}


def get_kb(uuid: str, owner_uuid: Optional[str] = None) -> Optional[Dict[str, Any]]:
    client = get_es_client()
    _ensure_indices(client)
    query: Dict[str, Any] = {"term": {"uuid": uuid}}
    if owner_uuid:
        query = {
            "bool": {
                "filter": [
                    {"term": {"uuid": uuid}},
                    {"term": {"owner_uuid.keyword": owner_uuid}},
                ]
            }
        }
    res = client.search(index=KB_INDEX, query=query)
    hits = res.get("hits", {}).get("hits", [])
    if not hits:
        return None
    return hits[0]["_source"]


# ==== doc ====


def create_doc(doc: Dict[str, Any]) -> None:
    client = get_es_client()
    _ensure_indices(client)
    client.index(index=KB_DOC_INDEX, document=doc)


def update_doc(uuid: str, fields: Dict[str, Any]) -> None:
    client = get_es_client()
    _ensure_indices(client)
    res = client.search(index=KB_DOC_INDEX, query={"term": {"uuid": uuid}})
    hits = res.get("hits", {}).get("hits", [])
    if not hits:
        return
    doc_id = hits[0]["_id"]
    client.update(index=KB_DOC_INDEX, id=doc_id, doc=fields)


def delete_doc(uuid: str) -> None:
    client = get_es_client()
    _ensure_indices(client)
    # delete doc
    res = client.search(index=KB_DOC_INDEX, query={"term": {"uuid": uuid}})
    hits = res.get("hits", {}).get("hits", [])
    for hit in hits:
        client.delete(index=KB_DOC_INDEX, id=hit["_id"])

    # delete corresponding vector
    client.delete_by_query(
        index=KB_DOC_EMBED_INDEX,
        body={"query": {"term": {"doc_uuid": uuid}}},
    )


def list_docs(kb_uuid: str, page: int, size: int) -> Dict[str, Any]:
    client = get_es_client()
    _ensure_indices(client)
    res = client.search(
        index=KB_DOC_INDEX,
        from_=(page - 1) * size,
        size=size,
        sort=[{"create_at": {"order": "desc"}}],
        query={"term": {"kb_uuid": kb_uuid}},
    )
    total = res.get("hits", {}).get("total", {}).get("value", 0)
    items = [hit["_source"] for hit in res.get("hits", {}).get("hits", [])]
    return {"total": total, "list": items}


def get_doc(uuid: str) -> Optional[Dict[str, Any]]:
    client = get_es_client()
    _ensure_indices(client)
    res = client.search(index=KB_DOC_INDEX, query={"term": {"uuid": uuid}})
    hits = res.get("hits", {}).get("hits", [])
    if not hits:
        return None
    return hits[0]["_source"]


# ==== vector ====


def upsert_doc_embeddings(
    kb_uuid: str, doc_uuid: str, chunks_with_embeddings: List[Dict[str, Any]]
) -> None:
    """
    write/update vector information for doc:
    - delete the existing vector corresponding to doc_uuid
    - then batch write new ones
    """
    client = get_es_client()
    _ensure_indices(client)
    # delete old
    client.delete_by_query(
        index=KB_DOC_EMBED_INDEX,
        body={"query": {"term": {"doc_uuid": doc_uuid}}},
    )
    # 写入新的
    for item in chunks_with_embeddings:
        body = {
            "uuid": item["uuid"],
            "kb_uuid": kb_uuid,
            "doc_uuid": doc_uuid,
            "chunk": item["chunk"],
            "embedding": item["embedding"],
            "create_at": item["create_at"],
        }
        client.index(index=KB_DOC_EMBED_INDEX, document=body)


def list_doc_embeddings(kb_uuid: str) -> List[Dict[str, Any]]:
    """
    get all doc vectors under a kb (simple implementation: fetch all at once, suitable for small data量）。
    """
    client = get_es_client()
    _ensure_indices(client)
    res = client.search(
        index=KB_DOC_EMBED_INDEX,
        size=1000,
        query={"term": {"kb_uuid": kb_uuid}},
    )
    hits = res.get("hits", {}).get("hits", [])
    return [hit["_source"] for hit in hits]


def search_doc_embeddings_by_vector(
    kb_uuid: str,
    query_vector: List[float],
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """
    Server-side vector similarity search using script_score cosine similarity.
    Returns top_k chunks with their scores.
    """
    client = get_es_client()
    _ensure_indices(client)
    response = client.search(
        index=KB_DOC_EMBED_INDEX,
        size=top_k,
        query={
            "script_score": {
                "query": {"term": {"kb_uuid": kb_uuid}},
                "script": {
                    "source": "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                    "params": {"query_vector": query_vector},
                },
            }
        },
    )
    hits = response.get("hits", {}).get("hits", [])
    results: List[Dict[str, Any]] = []
    for hit in hits:
        source = hit.get("_source", {})
        score = hit.get("_score", 0.0) - 1.0  # remove +1 offset
        source["score"] = score
        results.append(source)
    return results


def search_docs_fulltext(
    kb_uuid: str,
    query: str,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """
    Perform keyword-based full-text search with highlighting.
    """
    client = get_es_client()
    _ensure_indices(client)

    search_body = {
        "size": top_k,
        "query": {
            "bool": {
                "filter": [{"term": {"kb_uuid": kb_uuid}}],
                "must": [
                    {
                        "multi_match": {
                            "query": query,
                            "fields": ["title^2", "content"],
                            "type": "best_fields",
                            "fuzziness": "AUTO",
                        }
                    }
                ],
            }
        },
        "highlight": {
            "pre_tags": ["<mark>"],
            "post_tags": ["</mark>"],
            "fields": {
                "content": {"fragment_size": 120, "number_of_fragments": 2},
                "title": {"number_of_fragments": 0},
            },
        },
    }

    res = client.search(index=KB_DOC_INDEX, body=search_body)
    hits = res.get("hits", {}).get("hits", [])
    results: List[Dict[str, Any]] = []
    for hit in hits:
        source = hit.get("_source", {})
        highlight = hit.get("highlight", {})
        snippet_parts = highlight.get("content") or []
        snippet = "\n".join(snippet_parts) if snippet_parts else source.get("content", "")
        results.append(
            {
                "kb_uuid": source.get("kb_uuid"),
                "doc_uuid": source.get("uuid"),
                "title": source.get("title"),
                "content": source.get("content"),
                "snippet": snippet,
                "score": hit.get("_score", 0.0),
            }
        )
    return results


