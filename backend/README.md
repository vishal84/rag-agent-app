# RAG Agent Backend

FastAPI backend that ingests PDFs from a fixed Google Drive folder, chunks and
embeds them with Gemini, stores vectors in Qdrant, and answers chat queries
with page-level citations.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Configuration is read from the `.env` file at the repo root (see
`.env.example` there for the required keys: `GEMINI_API_KEY`,
`GOOGLE_DRIVE_FOLDER_ID`, `QDRANT_URL`, `QDRANT_COLLECTION`,
`GOOGLE_APPLICATION_CREDENTIALS`, `BACKEND_CORS_ORIGINS`).

## Google Drive service account

`DriveService` authenticates as a service account (a stand-in for a real MCP
Drive server; see `app/services/drive_service.py` for the rationale):

1. In Google Cloud Console, create a service account and a JSON key for it.
2. Share the target Drive folder (`GOOGLE_DRIVE_FOLDER_ID`) with the service
   account's email address (view access is enough).
3. Save the JSON key locally and point `GOOGLE_APPLICATION_CREDENTIALS` in the
   root `.env` at its path.

## Run

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

- `POST /api/ingest` — re-ingest all PDFs from the configured Drive folder.
- `GET /api/ingest/status` — last ingest run's status/counts.
- `POST /api/chat` — `{"message": str, "session_id": str | null}` -> answer with citations.
- `GET /api/documents` — list ingested documents.

## Tests

```bash
cd backend
pytest
```

All external SDKs (Google GenAI, Google Drive API, Qdrant) are mocked in
tests, so no network access or real credentials are required.
