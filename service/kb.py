import uuid
import math
import io
import json
import zipfile
from datetime import datetime
from typing import Optional, List, Dict, Any
import re

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
    search_doc_embeddings_by_vector,
    search_docs_fulltext,
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


def _generate_and_store_embeddings_for_doc(doc: KnowledgeDocument) -> None:
    chunks = _chunk_text(doc.content)
    if not chunks:
        return

    vectors: List[Dict[str, Any]] = []
    for chunk in chunks:
        embedding = create_embeddings(chunk)
        vectors.append(
            {
                "uuid": str(uuid.uuid4()),
                "chunk": chunk,
                "embedding": embedding,
                "create_at": _now_ms(),
            }
        )
    upsert_doc_embeddings(doc.kb_uuid, doc.uuid, vectors)


def qa_service(kb_uuid: str, question: str, top_k: int = 3) -> Optional[KnowledgeQAReply]:
    if not get_kb(kb_uuid):
        return None

    context_chunks = _retrieve_context_chunks(kb_uuid, question, top_k)
    messages = _build_messages_with_context(question, context_chunks)
    answer = chat_completion(messages)

    # write current Q&A into kb, and generate vector for the answer
    save_qa_to_kb(kb_uuid, question, answer)

    context_texts = [item["chunk"] for item in context_chunks]
    return KnowledgeQAReply(answer=answer, context=context_texts)


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

    query_vector = create_embeddings(query)
    results: List[Dict[str, Any]] = []
    try:
        results = search_doc_embeddings_by_vector(kb_uuid, query_vector, top_k)
    except Exception as exc:  # pylint: disable=broad-except
        print(f"[WARN] ES vector search failed, falling back to local scoring: {exc}")
        vectors = list_doc_embeddings(kb_uuid)
        results = _score_vectors_locally(
            vectors,
            query_vector,
            top_k=top_k,
            score_threshold=0.0,
        )

    formatted: List[Dict[str, Any]] = []
    for item in results[:top_k]:
        formatted.append(
            {
                "kb_uuid": item.get("kb_uuid"),
                "doc_uuid": item.get("doc_uuid"),
                "chunk": item.get("chunk", ""),
                "score": item.get("score", 0.0),
            }
        )
    return formatted


def fulltext_search_service(
    kb_uuid: str,
    query: str,
    top_k: int = 5,
) -> Optional[List[Dict[str, Any]]]:
    """
    Keyword-based full-text search with ES highlighting.
    """
    if not get_kb(kb_uuid):
        return None
    return search_docs_fulltext(kb_uuid, query, top_k)


def _retrieve_context_chunks(
    kb_uuid: str,
    question: str,
    top_k: int = 3,
    score_threshold: float = 0.2,
) -> List[Dict[str, Any]]:
    """
    Retrieve top_k most relevant chunks from KB embeddings.
    Falls back gracefully if no embeddings exist or ES vector search fails.
    """
    query_vector = create_embeddings(question)
    scored: List[Dict[str, Any]] = []

    try:
        scored = [
            item
            for item in search_doc_embeddings_by_vector(
                kb_uuid,
                query_vector,
                top_k=max(top_k, 5),
            )
            if item.get("score", 0.0) >= score_threshold
        ]
    except Exception as exc:  # pylint: disable=broad-except
        print(f"[WARN] ES vector search failed, fallback to local scoring: {exc}")
        vectors = list_doc_embeddings(kb_uuid)
        scored = _score_vectors_locally(
            vectors,
            query_vector,
            top_k=max(top_k, 5),
            score_threshold=score_threshold,
        )

    return scored[:top_k]


def _build_messages_with_context(
    question: str, context_chunks: List[Dict[str, Any]]
) -> List[Dict[str, str]]:
    """
    Construct system/user messages. Encourage the model to use KB context when available.
    """
    base_instruction = (
        "You are a helpful assistant. Use the provided knowledge base snippets when they are relevant. "
        "If the context does not contain sufficient information, clearly state that you are not sure "
        "instead of fabricating details."
    )

    messages: List[Dict[str, str]] = [{"role": "system", "content": base_instruction}]

    if context_chunks:
        context_text = "\n\n".join(
            f"[Score {item['score']:.2f}] {item['chunk']}" for item in context_chunks
        )
        messages.append({"role": "system", "content": f"Knowledge base context:\n{context_text}"})

    messages.append({"role": "user", "content": question})
    return messages


def _score_vectors_locally(
    vectors: List[Dict[str, Any]],
    query_vector: List[float],
    top_k: int,
    score_threshold: float,
) -> List[Dict[str, Any]]:
    """Fallback cosine scoring executed in Python."""
    scored: List[Dict[str, Any]] = []
    for item in vectors:
        emb = item.get("embedding") or []
        if not emb:
            continue
        score = _cosine_similarity(query_vector, emb)
        if score < score_threshold:
            continue
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


def export_kb_service(kb_uuid: str) -> Optional[Dict[str, Any]]:
    """
    Bundle kb metadata, documents, and embeddings into a zip for download.
    """
    kb_data = get_kb(kb_uuid)
    if not kb_data:
        return None

    docs = _fetch_all_docs(kb_uuid)
    embeddings = list_doc_embeddings(kb_uuid)

    bundle = {
        "kb": kb_data,
        "documents": docs,
        "embeddings": embeddings,
        "exported_at": _now_ms(),
    }

    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("kb.json", json.dumps(kb_data, ensure_ascii=False, indent=2))
        zf.writestr("docs.json", json.dumps(docs, ensure_ascii=False))
        zf.writestr(
            "embeddings.json",
            json.dumps(embeddings, ensure_ascii=False),
        )
        zf.writestr(
            "bundle.json",
            json.dumps(bundle, ensure_ascii=False),
        )

    memory_file.seek(0)
    safe_name = re.sub(r"[^a-zA-Z0-9_-]", "-", kb_data.get("name", "kb"))
    filename = f"{safe_name or 'kb'}-{kb_uuid[:8]}.zip"
    return {"filename": filename, "content": memory_file.read()}


def _fetch_all_docs(kb_uuid: str, page_size: int = 200) -> List[Dict[str, Any]]:
    docs: List[Dict[str, Any]] = []
    page = 1
    total = 0
    while True:
        batch = list_docs(kb_uuid, page, page_size)
        items = batch.get("list", [])
        total = batch.get("total", 0)
        docs.extend(items)
        if len(docs) >= total or not items:
            break
        page += 1
    return docs

