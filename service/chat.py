import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from dao.chat_dao import (
    create_chat,
    update_chat,
    delete_chat,
    get_chat,
    list_chats,
    append_message,
    list_messages,
)
from models.chat import Chat, ChatCreate, ChatMessage, ChatMessageCreate, ChatReply
from service.kb import save_qa_to_kb
from service.openai_service import chat_completion


def _now_ms() -> int:
    return int(datetime.utcnow().timestamp() * 1000)


def create_chat_service(user_uuid: str, req: ChatCreate) -> Chat:
    title = req.title or (req.first_question or "new chat")
    chat = Chat(
        uuid=str(uuid.uuid4()),
        kb_uuid=req.kb_uuid,
        title=title,
        user_uuid=user_uuid,
        create_at=_now_ms(),
        update_at=_now_ms(),
    )
    create_chat(chat.dict())

    # if there is a first question, insert it as the first user message and generate reply
    if req.first_question:
        user_msg = ChatMessage(
            uuid=str(uuid.uuid4()),
            chat_uuid=chat.uuid,
            role="user",
            content=req.first_question,
            create_at=_now_ms(),
        )
        append_message(user_msg.dict())
        # generate reply
        _generate_and_store_reply(chat, user_msg.content)

    return chat


def list_chats_service(user_uuid: str, page: int, size: int) -> Dict[str, Any]:
    return list_chats(user_uuid, page, size)


def delete_chat_service(user_uuid: str, chat_uuid: str) -> bool:
    chat_data = get_chat(chat_uuid)
    if not chat_data or chat_data.get("user_uuid") != user_uuid:
        return False
    delete_chat(chat_uuid)
    return True


def list_messages_service(user_uuid: str, chat_uuid: str, limit: int = 50) -> List[ChatMessage]:
    chat_data = get_chat(chat_uuid)
    if not chat_data or chat_data.get("user_uuid") != user_uuid:
        return []
    docs = list_messages(chat_uuid, limit)
    return [ChatMessage(**d) for d in docs]


def send_message_service(
    user_uuid: str, chat_uuid: str, req: ChatMessageCreate
) -> Optional[ChatReply]:
    chat_data = get_chat(chat_uuid)
    if not chat_data or chat_data.get("user_uuid") != user_uuid:
        return None

    chat_obj = Chat(**chat_data)

    # 1. insert user message
    user_msg = ChatMessage(
        uuid=str(uuid.uuid4()),
        chat_uuid=chat_uuid,
        role="user",
        content=req.content,
        create_at=_now_ms(),
    )
    append_message(user_msg.dict())

    # 2. generate reply (with kb RAG)
    reply = _generate_and_store_reply(chat_obj, req.content)

    # 3. 更新对话更新时间
    update_chat(chat_uuid, {"update_at": _now_ms(), "title": chat_obj.title})

    return reply


def _generate_and_store_reply(chat_obj: Chat, question: str) -> ChatReply:
    """
    only send current question to OpenAI:
    - do not use history conversation
    - do not use kb content
    - if kb_uuid is bound, write Q&A as doc into the kb (only for ES query)
    """
    # 1. only send current question to OpenAI
    answer = chat_completion([{"role": "user", "content": question}])

    # 2. insert assistant message
    assistant_msg = ChatMessage(
        uuid=str(uuid.uuid4()),
        chat_uuid=chat_obj.uuid,
        role="assistant",
        content=answer,
        create_at=_now_ms(),
    )
    append_message(assistant_msg.dict())

    # 3. if kb_uuid is bound, write Q&A as doc into the kb, and generate vector for the answer
    context_chunks: List[str] = []
    if chat_obj.kb_uuid:
        save_qa_to_kb(chat_obj.kb_uuid, question, answer)

    # context is empty, means no kb or history conversation content was fed to the model
    return ChatReply(answer=answer, context=context_chunks)


