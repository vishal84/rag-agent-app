from fastapi import APIRouter, Depends

from app.dependencies import get_claude_service, get_gemini_service, get_qdrant_service
from app.schemas import ChatRequest, ChatResponse, Citation
from app.services.claude_service import ClaudeService
from app.services.gemini_service import GeminiService
from app.services.qdrant_service import QdrantService

router = APIRouter(prefix="/api/chat", tags=["chat"])

TOP_K = 6
SNIPPET_LENGTH = 300


@router.post("", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    gemini: GeminiService = Depends(get_gemini_service),
    claude: ClaudeService = Depends(get_claude_service),
    qdrant: QdrantService = Depends(get_qdrant_service),
) -> ChatResponse:
    query_vector = gemini.embed_query(request.message)
    results = qdrant.search(query_vector, top_k=TOP_K)
    answer = claude.generate_answer(request.message, results)
    citations = [
        Citation(
            doc_name=result["doc_name"],
            file_id=result["file_id"],
            drive_url=result["drive_url"],
            page_number=result["page_number"],
            snippet=result["text"][:SNIPPET_LENGTH],
        )
        for result in results
    ]
    return ChatResponse(answer=answer, citations=citations)
