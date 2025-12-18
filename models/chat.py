from typing import Optional, List

from pydantic import BaseModel


class Chat(BaseModel):
    """chat session"""

    uuid: str
    kb_uuid: Optional[str] = None  # bound kb, can be empty (pure LLM chat)
    title: str
    user_uuid: str  # initiator
    create_at: int
    update_at: int


class ChatCreate(BaseModel):
    """create chat"""

    kb_uuid: Optional[str] = None
    title: Optional[str] = None
    first_question: Optional[str] = None


class ChatMessage(BaseModel):
    """single message"""

    uuid: str
    chat_uuid: str
    role: str  # user / assistant / system
    content: str
    create_at: int


class ChatMessageCreate(BaseModel):
    """user send message"""

    content: str


class ChatReply(BaseModel):
    """model reply + context"""

    answer: str
    context: List[str]


CHAT_INDEX = "chat_index"
CHAT_MESSAGE_INDEX = "chat_message_index"


