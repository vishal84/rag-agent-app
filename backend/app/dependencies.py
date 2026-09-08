from functools import lru_cache

from app.config import get_settings
from app.services.drive_service import DriveService
from app.services.gemini_service import GeminiService
from app.services.qdrant_service import QdrantService


@lru_cache
def get_drive_service() -> DriveService:
    settings = get_settings()
    return DriveService(
        folder_id=settings.GOOGLE_DRIVE_FOLDER_ID,
        credentials_path=settings.credentials_path,
    )


@lru_cache
def get_gemini_service() -> GeminiService:
    settings = get_settings()
    return GeminiService(api_key=settings.GEMINI_API_KEY)


@lru_cache
def get_qdrant_service() -> QdrantService:
    settings = get_settings()
    return QdrantService(url=settings.QDRANT_URL, collection_name=settings.QDRANT_COLLECTION)
