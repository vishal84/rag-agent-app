from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.dependencies import get_qdrant_service
from app.routers import chat, documents, ingest

settings = get_settings()

app = FastAPI(title="RAG Agent Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(chat.router)
app.include_router(documents.router)


@app.on_event("startup")
def ensure_qdrant_collection() -> None:
    get_qdrant_service().ensure_collection()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
