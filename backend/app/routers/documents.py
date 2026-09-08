from fastapi import APIRouter, Depends

from app.dependencies import get_qdrant_service
from app.schemas import DocumentSummary
from app.services.qdrant_service import QdrantService

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("", response_model=list[DocumentSummary])
def list_documents(qdrant: QdrantService = Depends(get_qdrant_service)) -> list[DocumentSummary]:
    docs: dict[str, dict] = {}
    for payload in qdrant.list_all_payloads():
        file_id = payload["file_id"]
        entry = docs.setdefault(file_id, {"doc_name": payload["doc_name"], "pages": set()})
        entry["pages"].add(payload["page_number"])
    return [
        DocumentSummary(doc_name=entry["doc_name"], file_id=file_id, page_count=len(entry["pages"]))
        for file_id, entry in docs.items()
    ]
