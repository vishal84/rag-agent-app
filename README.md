# RAG Agent App

An end-to-end agentic chat application over a fixed Google Drive folder of PDFs. Answers are grounded in the ingested documents and carry **page-level citations** — each citation renders as a `[DocName, p. X]` badge that opens a PDF preview scrolled to that exact page.

## How it works

```
Google Drive folder (PDFs)
        │  DriveService — restricted to one authorized folder
        ▼
   PDF bytes
        │  chunking — page-scoped, overlapping text chunks
        ▼
   Chunks (text + page_number + file_id + drive_url + doc_name)
        │  GeminiService.embed_texts — gemini-embedding-001 (3072-dim)
        ▼
   Qdrant (local, cosine) — vector + payload
        │
        ▼
   POST /api/chat
        │  embed query → top-6 vector search → grounded generation
        ▼
   { answer, citations[] }  →  Next.js UI → citation badge → PDF preview modal
```

The key design decision is that **chunks never span a page boundary**. Each chunk is cut from a single page's extracted text, so every chunk is attributable to exactly one `page_number` — which is what makes page-level citations possible rather than approximate.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18+ | Frontend (developed against v26) |
| Python 3.11+ | Backend (developed against 3.13) |
| Docker | For the local Qdrant instance |
| Gemini API key | From [Google AI Studio](https://aistudio.google.com/apikey) |
| Google Cloud service account | JSON key, for Drive access |

---

## Configuration

All configuration lives in a single `.env` at the repo root. `.env.example` is the checked-in template — copy it and fill in real values:

```bash
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Gemini API key for embeddings and generation |
| `GOOGLE_DRIVE_FOLDER_ID` | The **only** Drive folder the app is allowed to read |
| `QDRANT_URL` | Local Qdrant instance (default `http://localhost:6333`) |
| `QDRANT_COLLECTION` | Collection name (default `drive_documents`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the service-account JSON, resolved relative to the repo root |
| `BACKEND_CORS_ORIGINS` | Comma-separated allowed origins for the API |
| `NEXT_PUBLIC_API_BASE_URL` | Backend base URL the browser calls |

`.env` and any `service-account.json` are gitignored. Never commit either.

### Google Drive service account

Drive access is granted by *sharing*, not by IAM roles — a service account can see nothing until you explicitly share a folder with it.

1. In Google Cloud Console, enable the **Google Drive API** on your project.
2. Create a service account (no project roles needed) and generate a **JSON key**.
3. Save the key to `backend/service-account.json`.
4. Copy the service account's email (`…@….iam.gserviceaccount.com`) and share the target Drive folder with it as **Viewer**.

---

## Components

### Vector store — Qdrant

A local Qdrant instance holds one collection (`drive_documents`) of 3072-dimensional vectors with cosine distance. Each point's payload carries everything a citation needs:

```json
{ "page_number": 4, "file_id": "…", "drive_url": "…", "doc_name": "…", "text": "…" }
```

Run it with Docker:

```bash
docker run -d --name local-qdrant -p 6333:6333 -p 6334:6334 \
  -v "$(pwd)/qdrant_storage:/qdrant/storage" qdrant/qdrant
```

The collection is created automatically on backend startup, so the API behaves correctly before the first ingest instead of erroring on an absent collection.

---

### Backend — FastAPI (`backend/`)

```
backend/app/
├── main.py              FastAPI app, CORS, routers, startup collection check
├── config.py            pydantic-settings; reads the root .env
├── dependencies.py      lru_cache'd service factories, injected via Depends
├── schemas.py           Pydantic request/response models
├── routers/
│   ├── ingest.py        POST /api/ingest, GET /api/ingest/status
│   ├── chat.py          POST /api/chat
│   └── documents.py     GET /api/documents
└── services/
    ├── drive_service.py    Google Drive access (folder-restricted)
    ├── chunking.py         Page-aware PDF chunking
    ├── gemini_service.py   Embeddings + grounded generation
    └── qdrant_service.py   Vector upsert/search/scroll
```

#### `config.py`

A `pydantic-settings` `Settings` class that reads the repo-root `.env` via an absolute path, so the backend behaves identically regardless of the directory it's launched from. `credentials_path` resolves a relative `GOOGLE_APPLICATION_CREDENTIALS` against the repo root for the same reason.

#### `services/drive_service.py`

The only code permitted to talk to Google Drive. Its interface is deliberately MCP-tool-shaped (`list_pdfs(folder_id)`, `download_pdf(file_id)`) so it can later be swapped for a real MCP Drive client without touching any call site.

**Folder restriction is enforced on both operations**, which is a hard requirement of the spec:

- `list_pdfs` raises `DriveFolderAccessError` if asked for any folder other than the configured one — *before* making an API call.
- `download_pdf` fetches the file's `parents` metadata and refuses to stream bytes unless the authorized folder is among them. Since it takes only a `file_id`, this check is what prevents it being used to reach arbitrary Drive files.

#### `services/chunking.py`

Extracts text per page with `pypdf`, then splits each page independently into ~3000-character chunks with 400-character overlap (roughly 500–800 tokens). Because splitting happens *within* a page, every resulting `Chunk` carries a single unambiguous `page_number` and a prebuilt `drive_url` of the form:

```
https://drive.google.com/file/d/{file_id}/preview#page={page_number}
```

That URL is directly embeddable in an iframe, which is what the preview modal uses.

#### `services/gemini_service.py`

Wraps the `google-genai` SDK for both halves of the pipeline:

- **Embeddings** — `gemini-embedding-001`, batched at 100 inputs per call (the API's `batchEmbedContents` hard cap).
- **Generation** — `gemini-flash-latest`, prompted with the retrieved excerpts and instructed to cite every factual claim inline as `[DocName, p. X]`, or to say it doesn't know rather than guess.

Both calls are wrapped in `tenacity` retry with exponential backoff (up to 6 attempts, 2s→60s), triggered **only** on HTTP 429. Non-rate-limit errors surface immediately rather than being retried pointlessly.

> The model IDs matter here: `text-embedding-004` and `gemini-2.0-flash` are both retired and return 404s. `gemini-flash-latest` is an alias that tracks the current stable Flash model, so it won't go stale the same way.

#### `services/qdrant_service.py`

Thin wrapper over `qdrant-client`: `ensure_collection()`, `upsert_chunks()`, `search()`, and `list_all_payloads()` (a paged scroll used to build the document list). Vector size is pinned to 3072 to match the embedding model — changing embedding models requires recreating the collection.

#### Routers

| Endpoint | Behavior |
|---|---|
| `POST /api/ingest` | Full re-ingest: list PDFs → download → chunk → embed → upsert. Returns counts; failures are captured into the status object rather than thrown, so the UI can display them. |
| `GET /api/ingest/status` | Last run's status, document/chunk counts, timestamp, and error string. In-memory (resets on restart). |
| `POST /api/chat` | `{message, session_id}` → embed query → top-6 Qdrant search → grounded generation → `{answer, citations[]}` with 300-char snippets. |
| `GET /api/documents` | Ingested documents, deduplicated by `file_id`, with per-document page counts. |
| `GET /health` | Liveness check. |

#### Tests (`backend/tests/`)

12 tests, all external SDKs mocked — no network or credentials required.

| File | Covers |
|---|---|
| `test_chunking.py` | Page-boundary correctness, overlap arithmetic, blank pages |
| `test_drive_service.py` | Folder restriction on both list and download paths |
| `test_chat.py` | Citation response shape, empty-index behavior (via dependency overrides) |
| `test_gemini_service.py` | Retries on 429 then succeeds; does *not* retry non-429 errors |

---

### Frontend — Next.js App Router (repo root)

```
app/
├── layout.tsx           Root layout
├── page.tsx             Chat page — sidebar + chat window
└── globals.css          Tailwind entry
components/
├── ChatWindow.tsx       Message list, input, chat API calls
├── CitationBadge.tsx    [DocName, p. X] pill; opens the preview modal
├── PdfPreviewModal.tsx  Iframe preview of the cited Drive page
└── DocumentSidebar.tsx  Document list, ingest status, re-ingest button
lib/api.ts               Typed fetch client for all four endpoints
types/chat.ts            TS types mirroring the backend contract
```

Per the project's architectural boundary, the frontend talks **only** to the backend REST API — never to Google Drive or Qdrant directly.

#### `lib/api.ts` and `types/chat.ts`

A small typed fetch client (`sendChatMessage`, `getDocuments`, `triggerIngest`, `getIngestStatus`) reading its base URL from `NEXT_PUBLIC_API_BASE_URL`. The types in `types/chat.ts` mirror the backend's Pydantic schemas exactly; keeping them in sync is what makes `npm run build` catch contract drift at compile time.

#### `ChatWindow.tsx`

Renders the conversation and posts to `/api/chat`. Assistant messages render their returned citations as badges beneath the answer text. Session ID is a client-generated string held for the tab's lifetime.

#### `CitationBadge.tsx`

A compact pill showing `[DocName, p. X]` with a document icon. Clicking it opens the preview modal for that specific citation.

#### `PdfPreviewModal.tsx`

Embeds the citation's page-anchored `drive_url` in an iframe, with the document name and page number in the header. Closes on Escape or click-outside.

#### `DocumentSidebar.tsx`

Lists ingested documents with page counts, shows the last ingest run's status and counts, and exposes a **Re-ingest** button. Ingest errors returned by the backend are surfaced inline, so failures are visible in the UI rather than silent.

---

## Running locally

Three processes: Qdrant, the backend, and the frontend.

```bash
# 1. Qdrant
docker run -d --name local-qdrant -p 6333:6333 -p 6334:6334 \
  -v "$(pwd)/qdrant_storage:/qdrant/storage" qdrant/qdrant

# 2. Backend  (http://localhost:8000)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# 3. Frontend (http://localhost:3000)
npm install
npm run dev
```

Then trigger the first ingest:

```bash
curl -X POST http://localhost:8000/api/ingest
```

Interactive API docs are at `http://localhost:8000/docs`.

### Verification

```bash
npm run lint && npm run build   # frontend
cd backend && pytest            # backend
```

---

## Project status

**Working and verified:** backend boots and serves all endpoints; Qdrant collection auto-creates; Google Drive authentication and the folder restriction work against the real API; the frontend renders and is correctly wired to the backend; 12/12 backend tests, `npm run lint`, and `npm run build` all pass.

**Not yet verified end-to-end:** no document has been successfully ingested, and no citation has been generated or clicked in the running app. The Gemini project currently returns `403 PERMISSION_DENIED — Your project has been denied access`, which blocks both embeddings and generation. This is an account-level issue requiring Google support, not a code defect. Until it clears, the spec's acceptance criteria remain unproven.

**Known rough edges:**

- Ingest is synchronous and full-refresh — it re-embeds every document on every run. Incremental ingest keyed on Drive `modifiedTime` would be the natural next step.
- Ingest status is in-memory and resets on backend restart.
- `session_id` is accepted by the chat endpoint but no server-side conversation history is kept; each request is independent.
- Dependencies are declared in both `backend/pyproject.toml` and `backend/requirements.txt`; they currently agree, but `pyproject.toml` is the canonical source.

---

## Architectural notes

The spec calls for Drive and Qdrant access to go through MCP tools. No MCP server is provisioned in this environment, so `DriveService` and `QdrantService` use the official Python SDKs directly while keeping MCP-tool-shaped interfaces — the swap should be contained to those two files.

The spec also references an "ADK 2.0 / `agents-cli`" agent framework, which isn't available here. The backend implements a direct retrieve-then-generate flow instead of a graph-based agent workflow.
