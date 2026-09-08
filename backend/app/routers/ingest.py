from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.config import get_settings
from app.dependencies import get_drive_service, get_gemini_service, get_qdrant_service
from app.schemas import IngestStatus
from app.services.chunking import chunk_pdf
from app.services.drive_service import DriveService
from app.services.gemini_service import GeminiService
from app.services.qdrant_service import QdrantService

router = APIRouter(prefix="/api/ingest", tags=["ingest"])

_status = IngestStatus(status="never_run", documents_processed=0, chunks_upserted=0)


@router.post("", response_model=IngestStatus)
def ingest(
    drive: DriveService = Depends(get_drive_service),
    gemini: GeminiService = Depends(get_gemini_service),
    qdrant: QdrantService = Depends(get_qdrant_service),
) -> IngestStatus:
    global _status
    settings = get_settings()
    try:
        qdrant.ensure_collection()
        files = drive.list_pdfs(settings.GOOGLE_DRIVE_FOLDER_ID)
        total_chunks = 0
        for file in files:
            pdf_bytes = drive.download_pdf(file["id"])
            chunks = chunk_pdf(pdf_bytes, doc_name=file["name"], file_id=file["id"])
            if not chunks:
                continue
            vectors = gemini.embed_texts([chunk.text for chunk in chunks])
            payload_chunks = [
                {
                    "vector": vector,
                    "page_number": chunk.page_number,
                    "file_id": chunk.file_id,
                    "drive_url": chunk.drive_url,
                    "doc_name": chunk.doc_name,
                    "text": chunk.text,
                }
                for chunk, vector in zip(chunks, vectors)
            ]
            total_chunks += qdrant.upsert_chunks(payload_chunks)
        _status = IngestStatus(
            status="success",
            documents_processed=len(files),
            chunks_upserted=total_chunks,
            last_run_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as exc:
        _status = IngestStatus(
            status="error",
            documents_processed=_status.documents_processed,
            chunks_upserted=_status.chunks_upserted,
            last_run_at=_status.last_run_at,
            error=str(exc),
        )
    return _status


@router.get("/status", response_model=IngestStatus)
def ingest_status() -> IngestStatus:
    return _status
