from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from handler.user import router as user_router
from handler.admin.user import router as admin_user_router
from handler.kb import router as kb_router
from handler.chat import router as chat_router

app = FastAPI(
    title="KnowledgeBase",
    version="24.1.0",
    description="personal knowledge base",
    docs_url="/swagger-ui",
    redoc_url="/redoc",
    openapi_url="/api-docs/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router, prefix="/api/v1")
app.include_router(admin_user_router, prefix="/api/v1/admin")
app.include_router(kb_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
