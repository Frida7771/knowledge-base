from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from middleware.auth import get_current_user, UserClaim
from models.chat import ChatCreate, ChatMessageCreate, ChatReply, ChatMessage
from service import chat as chat_service


class ChatUpdateRequest(BaseModel):
    title: str


router = APIRouter(tags=["chat"])


@router.post("/chat", summary="create chat")
async def create_chat(
    req: ChatCreate,
    current_user: UserClaim = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        chat = chat_service.create_chat_service(current_user.uuid, req)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": str(exc)})
    return {"code": 200, "data": chat}


@router.get("/chat/list", summary="chat list")
async def list_chats(
    page: int = Query(1, description="current page"),
    size: int = Query(10, description="data per page"),
    current_user: UserClaim = Depends(get_current_user),
) -> Dict[str, Any]:
    data = chat_service.list_chats_service(current_user.uuid, page, size)
    return {"code": 200, "data": data}


@router.delete("/chat/{chat_uuid}", summary="delete chat")
async def delete_chat(
    chat_uuid: str,
    current_user: UserClaim = Depends(get_current_user),
) -> Dict[str, Any]:
    ok = chat_service.delete_chat_service(current_user.uuid, chat_uuid)
    if not ok:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "chat not found"})
    return {"code": 200, "msg": "delete success"}


@router.put("/chat/{chat_uuid}", summary="update chat title")
async def update_chat_title(
    chat_uuid: str,
    req: ChatUpdateRequest,
    current_user: UserClaim = Depends(get_current_user),
) -> Dict[str, Any]:
    ok = chat_service.update_chat_title_service(
        current_user.uuid, chat_uuid, req.title
    )
    if not ok:
        raise HTTPException(
            status_code=404, detail={"code": 404, "msg": "chat not found"}
        )
    return {"code": 200, "msg": "update success"}


@router.get("/chat/{chat_uuid}/messages", summary="message list", response_model=List[ChatMessage])
async def list_messages(
    chat_uuid: str,
    current_user: UserClaim = Depends(get_current_user),
) -> List[ChatMessage]:
    messages = chat_service.list_messages_service(current_user.uuid, chat_uuid, limit=100)
    if not messages:
        # maybe chat not found or no permission
        chat = chat_service.get_chat(chat_uuid) if hasattr(chat_service, "get_chat") else None
        if not chat:
            raise HTTPException(status_code=404, detail={"code": 404, "msg": "chat not found"})
    return messages


@router.post("/chat/{chat_uuid}/message", summary="send message", response_model=ChatReply)
async def send_message(
    chat_uuid: str,
    req: ChatMessageCreate,
    current_user: UserClaim = Depends(get_current_user),
) -> ChatReply:
    reply = chat_service.send_message_service(current_user.uuid, chat_uuid, req)
    if not reply:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "chat not found"})
    return reply


@router.post("/chat/{chat_uuid}/message/stream", summary="send message with streaming response")
async def send_message_stream(
    chat_uuid: str,
    req: ChatMessageCreate,
    current_user: UserClaim = Depends(get_current_user),
):
    generator = chat_service.stream_message_service(
        current_user.uuid, chat_uuid, req
    )
    if not generator:
        raise HTTPException(status_code=404, detail={"code": 404, "msg": "chat not found"})

    def iter_chunks():
        for chunk in generator:
            if chunk:
                yield chunk.encode("utf-8")

    return StreamingResponse(iter_chunks(), media_type="text/plain; charset=utf-8")


