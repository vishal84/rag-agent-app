from pydantic import BaseModel


class Citation(BaseModel):
    doc_name: str
    file_id: str
    drive_url: str
    page_number: int
    snippet: str


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]


class IngestStatus(BaseModel):
    status: str
    documents_processed: int
    chunks_upserted: int
    last_run_at: str | None = None
    error: str | None = None


class DocumentSummary(BaseModel):
    doc_name: str
    file_id: str
    page_count: int
