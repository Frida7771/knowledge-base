import io
from typing import Any, Dict

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse

from middleware.auth import get_current_user, UserClaim
from models.kb import (
    KnowledgeBaseCreate,
    KnowledgeBaseUpdate,
    KnowledgeDocumentCreate,
    KnowledgeDocumentUpdate,
    KnowledgeQARequest,
    KnowledgeQAReply,
)
from service import kb as kb_service
from pydantic import BaseModel

router = APIRouter(tags=["kb"])


# ==== 知识库管理 ====


@router.post("/kb", summary="create kb")
async def create_kb(
    req: KnowledgeBaseCreate,
    current_user: UserClaim = Depends(get_current_user),
) -> Dict[str, Any]:
    kb = kb_service.create_kb_service(req)
    return {"code": 200, "data": kb}


@router.get("/kb/list", summary="kb list")
async def list_kb(
    page: int = Query(1, description="current page"),
    size: int = Query(10, description="data per page"),
    current_user: UserClaim = Depends(get_current_user),
) -> Dict[str, Any]:
    data = kb_service.list_kb_service(page, size)
    return {"code": 200, "data": data}


@router.put("/kb/{kb_uuid}", summary="update kb")
async def update_kb(
    kb_uuid: str,
    req: KnowledgeBaseUpdate,
    current_user: UserClaim = Depends(get_current_user),
) -> Dict[str, Any]:
    kb = kb_service.update_kb_service(kb_uuid, req)
    if not kb:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "kb not found"})
    return {"code": 200, "data": kb}


@router.delete("/kb/{kb_uuid}", summary="delete kb")
async def delete_kb(
    kb_uuid: str,
    current_user: UserClaim = Depends(get_current_user),
) -> Dict[str, Any]:
    ok = kb_service.delete_kb_service(kb_uuid)
    if not ok:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "kb not found"})
    return {"code": 200, "msg": "delete success"}


# ==== 文档管理 ====


@router.post("/kb/{kb_uuid}/doc", summary="create doc in kb")
async def create_doc(
    kb_uuid: str,
    req: KnowledgeDocumentCreate,
    current_user: UserClaim = Depends(get_current_user),
) -> Dict[str, Any]:
    doc = kb_service.create_doc_service(kb_uuid, req)
    if not doc:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "kb not found"})
    return {"code": 200, "data": doc}


@router.get("/kb/{kb_uuid}/doc/list", summary="doc list in kb")
async def list_docs(
    kb_uuid: str,
    page: int = Query(1, description="current page"),
    size: int = Query(10, description="data per page"),
    current_user: UserClaim = Depends(get_current_user),
) -> Dict[str, Any]:
    data = kb_service.list_docs_service(kb_uuid, page, size)
    return {"code": 200, "data": data}


@router.put("/kb/doc/{doc_uuid}", summary="update doc")
async def update_doc(
    doc_uuid: str,
    req: KnowledgeDocumentUpdate,
    current_user: UserClaim = Depends(get_current_user),
) -> Dict[str, Any]:
    doc = kb_service.update_doc_service(doc_uuid, req)
    if not doc:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "doc not found"})
    return {"code": 200, "data": doc}


@router.delete("/kb/doc/{doc_uuid}", summary="delete doc")
async def delete_doc(
    doc_uuid: str,
    current_user: UserClaim = Depends(get_current_user),
) -> Dict[str, Any]:
    ok = kb_service.delete_doc_service(doc_uuid)
    if not ok:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "doc not found"})
    return {"code": 200, "msg": "delete success"}


@router.get("/kb/{kb_uuid}/export", summary="export kb bundle")
async def export_kb(
    kb_uuid: str,
    current_user: UserClaim = Depends(get_current_user),
):
    bundle = kb_service.export_kb_service(kb_uuid)
    if not bundle:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "kb not found"})
    bytes_io = io.BytesIO(bundle["content"])
    headers = {
        "Content-Disposition": f'attachment; filename="{bundle["filename"]}"'
    }
    return StreamingResponse(bytes_io, media_type="application/zip", headers=headers)


# ==== QA ====


@router.post("/kb/{kb_uuid}/qa", response_model=KnowledgeQAReply, summary="kb qa")
async def kb_qa(
    kb_uuid: str,
    req: KnowledgeQARequest,
    current_user: UserClaim = Depends(get_current_user),
) -> KnowledgeQAReply:
    result = kb_service.qa_service(kb_uuid, req.question, req.top_k)
    if not result:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "kb not found"})
    return result


class SemanticSearchRequest(BaseModel):
    query: str
    top_k: int = 5


class FullTextSearchRequest(BaseModel):
    query: str
    top_k: int = 5


@router.post("/kb/{kb_uuid}/semantic-search", summary="kb vector semantic search")
async def semantic_search(
    kb_uuid: str,
    req: SemanticSearchRequest,
    current_user: UserClaim = Depends(get_current_user),
):
    result = kb_service.semantic_search_service(kb_uuid, req.query, req.top_k)
    if result is None:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "kb not found"})
    return {"code": 200, "data": result}


@router.post("/kb/{kb_uuid}/fulltext-search", summary="kb keyword search")
async def fulltext_search(
    kb_uuid: str,
    req: FullTextSearchRequest,
    current_user: UserClaim = Depends(get_current_user),
):
    result = kb_service.fulltext_search_service(kb_uuid, req.query, req.top_k)
    if result is None:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "kb not found"})
    return {"code": 200, "data": result}


