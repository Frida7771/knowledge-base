import uuid
import math
from datetime import datetime
from typing import Optional, List, Dict, Any

from dao.kb_dao import (
    create_kb,
    update_kb,
    delete_kb,
    list_kb,
    get_kb,
    create_doc,
    update_doc,
    delete_doc,
    list_docs,
    get_doc,
    upsert_doc_embeddings,
    list_doc_embeddings,
)
from models.kb import (
    KnowledgeBase,
    KnowledgeBaseCreate,
    KnowledgeBaseUpdate,
    KnowledgeDocument,
    KnowledgeDocumentCreate,
    KnowledgeDocumentUpdate,
    KnowledgeQAReply,
)
from service.openai_service import chat_completion, create_embeddings


def _now_ms() -> int:
    return int(datetime.utcnow().timestamp() * 1000)


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ==== kb ====


def create_kb_service(req: KnowledgeBaseCreate) -> KnowledgeBase:
    kb = KnowledgeBase(
        uuid=str(uuid.uuid4()),
        name=req.name,
        description=req.description,
        create_at=_now_ms(),
        update_at=_now_ms(),
    )
    create_kb(kb.dict())
    return kb


def update_kb_service(uuid_: str, req: KnowledgeBaseUpdate) -> Optional[KnowledgeBase]:
    kb_data = get_kb(uuid_)
    if not kb_data:
        return None

    fields: Dict[str, Any] = {}
    if req.name is not None:
        fields["name"] = req.name
    if req.description is not None:
        fields["description"] = req.description
    if not fields:
        return KnowledgeBase(**kb_data)

    fields["update_at"] = _now_ms()
    update_kb(uuid_, fields)
    kb_data.update(fields)
    return KnowledgeBase(**kb_data)


def delete_kb_service(uuid_: str) -> bool:
    kb_data = get_kb(uuid_)
    if not kb_data:
        return False
    delete_kb(uuid_)
    return True


def list_kb_service(page: int, size: int) -> Dict[str, Any]:
    return list_kb(page, size)


# ==== doc ====


def create_doc_service(
    kb_uuid: str, req: KnowledgeDocumentCreate
) -> Optional[KnowledgeDocument]:
    if not get_kb(kb_uuid):
        return None

    doc = KnowledgeDocument(
        uuid=str(uuid.uuid4()),
        kb_uuid=kb_uuid,
        title=req.title,
        content=req.content,
        create_at=_now_ms(),
        update_at=_now_ms(),
    )
    create_doc(doc.dict())

    # generate embedding and write into
    _generate_and_store_embeddings_for_doc(doc)

    return doc


def update_doc_service(
    uuid_: str, req: KnowledgeDocumentUpdate
) -> Optional[KnowledgeDocument]:
    doc_data = get_doc(uuid_)
    if not doc_data:
        return None

    fields: Dict[str, Any] = {}
    if req.title is not None:
        fields["title"] = req.title
    if req.content is not None:
        fields["content"] = req.content
    if not fields:
        return KnowledgeDocument(**doc_data)

    fields["update_at"] = _now_ms()
    update_doc(uuid_, fields)
    doc_data.update(fields)
    doc = KnowledgeDocument(**doc_data)

    # if content has changed, regenerate embedding
    if req.content is not None:
        _generate_and_store_embeddings_for_doc(doc)

    return doc


def delete_doc_service(uuid_: str) -> bool:
    doc_data = get_doc(uuid_)
    if not doc_data:
        return False
    delete_doc(uuid_)
    return True


def list_docs_service(kb_uuid: str, page: int, size: int) -> Dict[str, Any]:
    return list_docs(kb_uuid, page, size)


def _chunk_text(content: str, max_chars: int = 400) -> List[str]:
    """
    currently kb is mainly used for ES query, not fed to OpenAI.
    keep a simple chunking function for future extension.
    """
    content = content.strip()
    if not content:
        return []
    chunks: List[str] = []
    start = 0
    while start < len(content):
        end = min(start + max_chars, len(content))
        chunks.append(content[start:end])
        start = end
    return chunks


def qa_service(kb_uuid: str, question: str, top_k: int = 3) -> Optional[KnowledgeQAReply]:
    if not get_kb(kb_uuid):
        return None

    # no longer use kb content to feed to OpenAI, only do normal qa
    messages = [
        {
            "role": "user",
            "content": question,
        }
    ]
    answer = chat_completion(messages)

    # write current Q&A into kb, and generate vector for the answer
    save_qa_to_kb(kb_uuid, question, answer)

    # context is empty, means no kb content was fed to the model
    return KnowledgeQAReply(answer=answer, context=[])


def save_qa_to_kb(kb_uuid: str, question: str, answer: str) -> None:
    """
    write current Q&A into kb, and generate vector for the answer
    """
    doc = KnowledgeDocument(
        uuid=str(uuid.uuid4()),
        kb_uuid=kb_uuid,
        title=question[:50],
        content=f"Q: {question}\n\nA: {answer}",
        create_at=_now_ms(),
        update_at=_now_ms(),
    )
    create_doc(doc.dict())

    # only generate embedding for the answer text
    embedding = create_embeddings(answer)
    upsert_doc_embeddings(
        kb_uuid,
        doc.uuid,
        [
            {
                "uuid": str(uuid.uuid4()),
                "chunk": answer,
                "embedding": embedding,
                "create_at": _now_ms(),
            }
        ],
    )


def semantic_search_service(kb_uuid: str, query: str, top_k: int = 5) -> Optional[List[Dict[str, Any]]]:
    """
    do vector semantic search for the specified kb:
    - generate embedding for the query
    - fetch all vectors under the kb from kb_doc_embed_index
    - calculate cosine similarity, return top_k chunks + scores
    """
    if not get_kb(kb_uuid):
        return None

    q_emb = create_embeddings(query)
    vectors = list_doc_embeddings(kb_uuid)
    scored: List[Dict[str, Any]] = []
    for item in vectors:
        emb = item.get("embedding") or []
        score = _cosine_similarity(q_emb, emb)
        scored.append(
            {
                "kb_uuid": item.get("kb_uuid"),
                "doc_uuid": item.get("doc_uuid"),
                "chunk": item.get("chunk", ""),
                "score": score,
            }
        )
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


