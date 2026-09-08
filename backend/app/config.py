from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT_ENV = REPO_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(REPO_ROOT_ENV), extra="ignore")

    GEMINI_API_KEY: str
    GOOGLE_DRIVE_FOLDER_ID: str
    QDRANT_URL: str
    QDRANT_COLLECTION: str
    GOOGLE_APPLICATION_CREDENTIALS: str
    BACKEND_CORS_ORIGINS: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def credentials_path(self) -> str:
        """Resolved relative to the repo root, independent of the process's launch directory."""
        path = Path(self.GOOGLE_APPLICATION_CREDENTIALS)
        return str(path if path.is_absolute() else REPO_ROOT / path)


@lru_cache
def get_settings() -> Settings:
    return Settings()
