from typing import Optional, List

from pydantic import BaseModel


class KnowledgeBase(BaseModel):
    """kb entity"""

    uuid: str
    name: str
    description: Optional[str] = None
    create_at: int
    update_at: int


class KnowledgeBaseCreate(BaseModel):
    """create kb request"""

    name: str
    description: Optional[str] = None


class KnowledgeBaseUpdate(BaseModel):
    """update kb request"""

    name: Optional[str] = None
    description: Optional[str] = None


class KnowledgeDocument(BaseModel):
    """kb document"""

    uuid: str
    kb_uuid: str
    title: str
    content: str
    create_at: int
    update_at: int


class KnowledgeDocumentCreate(BaseModel):
    """create/import doc request"""

    title: str
    content: str


class KnowledgeDocumentUpdate(BaseModel):
    """update doc request"""

    title: Optional[str] = None
    content: Optional[str] = None


class KnowledgeQARequest(BaseModel):
    """kb qa request"""

    question: str
    top_k: int = 3


class KnowledgeQAReply(BaseModel):
    """kb qa response"""

    answer: str
    context: List[str]


KB_INDEX = "kb_index"
KB_DOC_INDEX = "kb_doc_index"
KB_DOC_EMBED_INDEX = "kb_doc_embed_index"


