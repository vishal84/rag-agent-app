# RAG Agent App

An end-to-end agentic chat application over a fixed Google Drive folder of PDFs. Answers are grounded in the ingested documents and carry **page-level citations** — each citation renders as a `[DocName, p. X]` badge that opens a PDF preview scrolled to that exact page.

**Table of Contents**

- [How It Works](#how-it-works)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Architecture](#architecture)
  - [System Overview](#system-overview)
  - [Backend Components](#backend-components)
  - [Frontend Components](#frontend-components)
  - [Data Flow](#data-flow)
- [Running Locally](#running-locally)
  - [Using Make (Recommended)](#using-make-recommended)
  - [Manual Setup](#manual-setup)
  - [Verifying Everything Works](#verifying-everything-works)
- [Available Commands](#available-commands)
- [Testing](#testing)
- [Project Status](#project-status)
- [Known Issues & Rough Edges](#known-issues--rough-edges)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## How It Works

The application implements a retrieval-augmented generation (RAG) pipeline with citation tracking:

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
        │  embed query (Gemini) → top-6 vector search → generation (Claude)
        ▼
   { answer, citations[] }  →  Next.js UI → citation badge → PDF preview modal
```

### The Citation Contract

The key design decision is that **chunks never span a page boundary**. Each chunk is cut from a single page's extracted text, so every chunk carries a single unambiguous `page_number` and a prebuilt `drive_url`:

```
https://drive.google.com/file/d/{file_id}/preview#page={page_number}
```

This URL is directly embeddable in an iframe, which is what the preview modal uses. This means every citation is precise down to the page number and can be immediately verified by the user.

---

## Key Features

- **Page-level citations**: Every answer backed by citations down to the exact PDF page
- **Folder-scoped access**: Hard-restricted to a single Google Drive folder — no data leakage
- **Embeddings on Gemini**: 3072-dimensional vectors via `gemini-embedding-001`
- **Generation on Claude**: Grounded answer synthesis via `claude-sonnet-5`
- **Local vector DB**: Qdrant instance stores and searches embeddings locally
- **Full-text retrieval**: Top-6 documents retrieved per query, displayed with snippets
- **Zero conversation history**: Stateless chat (each turn is independent)

---

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Frontend** | Next.js (App Router) | 14.2+ |
| **Frontend Framework** | React | 18.3+ |
| **Frontend Styling** | Tailwind CSS | 3.4+ |
| **Frontend Icons** | Lucide React | - |
| **Frontend Language** | TypeScript | 5.5+ |
| **Backend API** | FastAPI | 0.115+ |
| **Backend Language** | Python | 3.11+ |
| **Vector Database** | Qdrant | latest |
| **Embeddings Model** | Gemini `gemini-embedding-001` | 3072-dim |
| **Generation Model** | Claude `claude-sonnet-5` | latest |
| **Embeddings SDK** | `google-genai` | 2.22+ |
| **Generation SDK** | `anthropic` | 1.4+ |
| **Drive SDK** | `google-api-python-client` | 2.158+ |
| **PDF Parser** | `pypdf` | 5.1+ |
| **Container Runtime** | Docker | - |

---

## Prerequisites

Before getting started, ensure you have all of these installed and configured:

### System Requirements

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | 18+ | Frontend runtime (developed against v26) |
| **npm or pnpm** | latest | Frontend package manager |
| **Python** | 3.11+ | Backend runtime (developed against 3.13) |
| **Docker** | latest | For the local Qdrant instance |
| **Git** | latest | For version control |

### API Keys & Credentials

You will need the following before running the app:

| Service | Credential | Where to Get | Purpose |
|---|---|---|---|
| **Google AI Studio** | Gemini API Key | https://aistudio.google.com/apikey | Embeddings only |
| **Anthropic Console** | Claude API Key | https://console.anthropic.com/ | Answer generation |
| **Google Cloud Console** | Service Account JSON | https://console.cloud.google.com/ | Google Drive folder access |

### Google Drive Service Account Setup (Required)

Drive access is granted via **sharing**, not IAM roles. A service account can see nothing until you explicitly share a folder with it. Here's how to set it up:

1. **Enable Google Drive API** in Google Cloud Console
   - Go to https://console.cloud.google.com/
   - Search for "Google Drive API" and enable it

2. **Create a service account**
   - Go to APIs & Services → Service Accounts
   - Click "Create Service Account"
   - Fill in Name, Description (optional), and click "Create and Continue"
   - Skip the optional steps and click "Done"

3. **Generate a JSON key**
   - Click on the service account you just created
   - Go to the "Keys" tab
   - Click "Add Key" → "Create new key" → **JSON**
   - A JSON file downloads automatically — this is your `service-account.json`
   - Save it to `backend/service-account.json` (this file is gitignored)

4. **Share the target Google Drive folder**
   - Copy the service account email (visible on the service account page, ends with `@…iam.gserviceaccount.com`)
   - Go to your Google Drive folder
   - Right-click → Share
   - Paste the service account email and grant **Viewer** access
   - Click Share

5. **Grab the folder ID**
   - Open the folder in Google Drive
   - Copy the ID from the URL: `https://drive.google.com/drive/folders/{FOLDER_ID}`
   - This is your `GOOGLE_DRIVE_FOLDER_ID`

---

## Quick Start

The fastest way to get the app running is with the `Makefile`:

```bash
# 1. Clone the repository
git clone https://github.com/vishal84/rag-agent-app.git
cd rag-agent-app

# 2. Set up environment variables
cp .env.example .env

# Then edit .env with your keys:
# - GEMINI_API_KEY
# - CLAUDE_API_KEY
# - GOOGLE_DRIVE_FOLDER_ID (from the Drive folder you shared with the service account)
# - GOOGLE_APPLICATION_CREDENTIALS=./backend/service-account.json
# - BACKEND_CORS_ORIGINS (default: http://localhost:3000)
# - NEXT_PUBLIC_API_BASE_URL (default: http://localhost:8000)

# 3. Install dependencies
make install

# 4. Start all services (Qdrant, backend, frontend)
make up

# 5. Access the app
# Frontend: http://localhost:3000
# Backend API docs: http://localhost:8000/docs

# 6. Trigger the first ingest
make ingest
```

The Makefile will:
- Start Qdrant in Docker (with persistent storage in `qdrant_storage/`)
- Start the FastAPI backend on port 8000 (with auto-reload)
- Start the Next.js frontend on port 3000 (with hot reload)
- Wait for each service to become healthy before starting the next

The app is ready when you see all three services marked as "ready".

---

## Environment Variables

All configuration lives in `.env` at the repo root. Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### Required Variables

These must be set, or the backend will fail to start:

| Variable | Purpose | Example |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for embeddings | `AIza…` |
| `CLAUDE_API_KEY` | Anthropic Claude API key for generation | `sk-ant-…` |
| `GOOGLE_DRIVE_FOLDER_ID` | Google Drive folder ID (the **only** folder the app can read) | `1RxJbIK…` |
| `QDRANT_URL` | Qdrant database URL | `http://localhost:6333` |
| `QDRANT_COLLECTION` | Qdrant collection name | `drive_documents` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the service account JSON key (relative to repo root) | `./backend/service-account.json` |

### Optional but Important

| Variable | Purpose | Default | Notes |
|---|---|---|---|
| `BACKEND_CORS_ORIGINS` | Comma-separated allowed origins for the API | - | **Critical for local dev**: must include `http://localhost:3000` |
| `NEXT_PUBLIC_API_BASE_URL` | Backend base URL the browser calls | `http://localhost:8000` | Must match where the backend is running |

### Development Defaults

For local development, this is a working `.env`:

```bash
GEMINI_API_KEY=your-gemini-api-key
CLAUDE_API_KEY=your-claude-api-key
GOOGLE_DRIVE_FOLDER_ID=your-google-drive-folder-id
GOOGLE_APPLICATION_CREDENTIALS=./backend/service-account.json
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=drive_documents
BACKEND_CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## Architecture

### System Overview

The application is composed of three independent services that communicate over HTTP and local network:

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Next.js React Frontend                           │  │
│  │ Port 3000                                        │  │
│  │ ┌────────────────────────────────────────────┐   │  │
│  │ │ ChatWindow, CitationBadge, PdfPreviewModal│   │  │
│  │ └────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────┘  │
│                      ↕ (HTTP REST)                     │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Localhost:8000                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ FastAPI Backend                                  │  │
│  │ ┌────────────────────────────────────────────┐   │  │
│  │ │ /api/ingest, /api/chat, /api/documents    │   │  │
│  │ │ Services: Drive, Chunking, Gemini, Claude │   │  │
│  │ │ Router                                     │   │  │
│  │ └────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────┘  │
│   ↕ (Python SDK)        ↕ (Vector DB)  ↕ (Python SDK) │
└──────────────┬───────────┬──────────────┬──────────────┘
      Google   │           │              │  Claude
      Drive    │           ↓              │  API
               │     Qdrant (local)       │
               │     Port 6333            │
               ↓                          ↓
          (streamed                  (API call)
           bytes)
```

### Directory Structure

```
rag-agent-app/
├── README.md                          # This file
├── CLAUDE.md                          # Project directives and architecture spec
├── Makefile                           # Local service orchestration
├── .env.example                       # Env var template (checked in)
├── .env                               # Your local env vars (gitignored)
│
├── frontend/                          # Next.js App Router (Node.js)
│   ├── package.json                   # Frontend dependencies
│   ├── tsconfig.json                  # TypeScript config
│   ├── next.config.js                 # Loads repo-root .env
│   ├── tailwind.config.js             # Tailwind CSS config
│   ├── app/
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Chat page
│   │   └── globals.css                # Global Tailwind styles
│   ├── components/
│   │   ├── AppShell.tsx               # Responsive shell, drawer, theme
│   │   ├── ChatWindow.tsx             # Message list, input, API calls
│   │   ├── CitationBadge.tsx          # [DocName, p. X] badge
│   │   ├── PdfPreviewModal.tsx        # Iframe PDF preview
│   │   └── DocumentSidebar.tsx        # Docs list, ingest status
│   ├── lib/
│   │   └── api.ts                     # Typed fetch client
│   └── types/
│       └── chat.ts                    # TypeScript types (mirroring backend)
│
├── backend/                           # FastAPI (Python 3.11+)
│   ├── pyproject.toml                 # Dependencies and project config
│   ├── pytest.ini                     # Pytest configuration
│   ├── service-account.json           # Google Drive credentials (gitignored)
│   ├── app/
│   │   ├── main.py                    # FastAPI app, CORS, startup hooks
│   │   ├── config.py                  # pydantic-settings, reads .env
│   │   ├── dependencies.py            # Service factories
│   │   ├── schemas.py                 # Pydantic request/response models
│   │   ├── routers/
│   │   │   ├── ingest.py              # POST /api/ingest, GET /api/ingest/status
│   │   │   ├── chat.py                # POST /api/chat
│   │   │   └── documents.py           # GET /api/documents
│   │   └── services/
│   │       ├── drive_service.py       # Google Drive access (folder-restricted)
│   │       ├── chunking.py            # Page-aware PDF chunking
│   │       ├── gemini_service.py      # Embeddings (gemini-embedding-001)
│   │       ├── claude_service.py      # Grounded answer generation
│   │       └── qdrant_service.py      # Vector DB upsert/search
│   └── tests/
│       ├── test_chunking.py           # Page-boundary correctness
│       ├── test_drive_service.py      # Folder restriction
│       ├── test_chat.py               # Citation response shape
│       ├── test_gemini_service.py     # Retry logic
│       └── test_claude_service.py     # Generation, thinking-block filtering
│
├── qdrant_storage/                    # Qdrant vector DB (persistent)
│   └── [vector collections]
│
├── .claude/                           # Claude Code project directives
│   ├── settings.json                  # Project-level settings
│   └── skills/
│       └── readme/
│           └── SKILL.md               # README generator skill
│
└── specs/                             # Architecture and feature specs
    ├── active-feature.md              # Current feature being built
    └── material-design-ui.md          # UI design specifications
```

### Backend Components

#### `app/main.py`

The FastAPI application entry point:

- Configures CORS middleware (trusts origins from `BACKEND_CORS_ORIGINS`)
- Registers startup hooks to ensure Qdrant collection exists on boot
- Mounts routers: `/api/ingest`, `/api/chat`, `/api/documents`
- Exposes `/health` for liveness checks

#### `app/config.py`

A `pydantic-settings.Settings` class that reads `.env` from the repo root via an absolute path. This ensures the backend behaves identically regardless of the directory it's launched from.

Key behaviors:
- Reads `.env` from `{repo_root}/.env`
- Resolves `GOOGLE_APPLICATION_CREDENTIALS` relative to the repo root (so a relative path like `./backend/service-account.json` works from any directory)
- Fails at import time if a required variable is missing (rather than at request time)

#### `app/schemas.py`

Pydantic models for all request/response contracts:

```python
# Request
class ChatRequest(BaseModel):
    message: str
    session_id: str

# Response
class Citation(BaseModel):
    doc_name: str
    page_number: int
    snippet: str
    drive_url: str

class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
```

These are intentionally mirrored in `frontend/types/chat.ts` so that TypeScript can catch contract drift at compile time.

#### `services/drive_service.py`

The only code permitted to talk to Google Drive. Its interface is deliberately MCP-tool-shaped so it can later be swapped for a real MCP Drive client.

**Folder restriction is enforced on both operations**:

- `list_pdfs(folder_id)` — raises `DriveFolderAccessError` if asked for any folder other than the configured one (before making an API call)
- `download_pdf(file_id)` — fetches the file's `parents` metadata and refuses to stream bytes unless the authorized folder is among them. This prevents the function from being used to reach arbitrary Drive files.

#### `services/chunking.py`

Extracts text per page using `pypdf`, then splits each page independently into chunks of ~3000 characters with 400-character overlap (roughly 500–800 tokens per chunk).

Why page boundaries matter:
- Every chunk knows its exact `page_number` (no ambiguity)
- Pre-builds `drive_url` pointing to that specific page
- Makes page-level citations possible, not approximate

```python
# Example chunk
Chunk(
    page_number=4,
    text="The quick brown fox...",
    file_id="abc123",
    drive_url="https://drive.google.com/file/d/abc123/preview#page=4",
    doc_name="document.pdf"
)
```

#### `services/gemini_service.py`

Wraps the `google-genai` SDK for **embeddings only** using `gemini-embedding-001` (3072-dimensional).

Features:
- Batches up to 100 texts per API call (the hard limit)
- Wraps calls in `tenacity` retry with exponential backoff (up to 6 attempts: 2s → 4s → 8s → 16s → 32s → 60s)
- Only retries on HTTP 429 (rate limit); non-rate-limit errors surface immediately
- **Important**: Model ID is pinned to `text-embedding-004`; older versions return 404s

#### `services/claude_service.py`

Wraps the `anthropic` SDK for grounded generation using `claude-sonnet-5`.

Key design choices:
- Citation instructions live in the `system` prompt, not the user turn (prevents documents from redefining rules)
- No `tenacity` wrapper (Anthropic SDK already retries internally)
- Filters out thinking blocks; only joins `text` content blocks into the final answer

Example system prompt:
```
You are a helpful assistant. Answer questions based on the provided excerpts.
Cite every factual claim as [DocName, p. X]. If you don't know, say so.
```

#### `services/qdrant_service.py`

Thin wrapper over the `qdrant-client` with these methods:

- `ensure_collection()` — Creates the collection if it doesn't exist, pinned to 3072-dim vectors with cosine distance
- `upsert_chunks(chunks)` — Inserts or updates chunk vectors with full payload
- `search(query_vector, top_k=6)` — Returns top K similar chunks with full metadata
- `list_all_payloads()` — Paged scroll to build the document list

#### Routers

**POST /api/ingest**

Full re-ingest workflow:
1. List all PDFs in the configured Google Drive folder
2. Download each PDF
3. Chunk with page boundaries
4. Embed all chunks with Gemini
5. Upsert into Qdrant
6. Return counts and any errors

Returns:
```json
{
  "documents_processed": 5,
  "chunks_created": 342,
  "chunks_indexed": 342,
  "error": null,
  "timestamp": "2024-09-09T12:34:56Z"
}
```

Failures are captured into the response rather than thrown, so the UI can display them.

**GET /api/ingest/status**

Last run's status (in-memory, resets on restart):
```json
{
  "documents_processed": 5,
  "chunks_created": 342,
  "chunks_indexed": 342,
  "error": null,
  "timestamp": "2024-09-09T12:34:56Z"
}
```

**POST /api/chat**

Grounded answer generation:
1. Embed the user's message with Gemini
2. Search Qdrant for top 6 similar chunks
3. Generate an answer with Claude, prompted to cite the retrieved chunks
4. Return the answer with parsed citations

Request:
```json
{
  "message": "What does the document say about X?",
  "session_id": "abc123"
}
```

Response:
```json
{
  "answer": "The document says X... [Document A, p. 5]",
  "citations": [
    {
      "doc_name": "Document A",
      "page_number": 5,
      "snippet": "The key text excerpt...",
      "drive_url": "https://drive.google.com/file/d/xyz/preview#page=5"
    }
  ]
}
```

**GET /api/documents**

Ingested documents with page counts (deduplicated by file ID):
```json
{
  "documents": [
    {
      "file_id": "abc123",
      "doc_name": "Document A",
      "page_count": 12
    }
  ]
}
```

**GET /health**

Liveness check — returns 200 if the service is running.

### Frontend Components

#### Next.js Configuration

- **Router**: App Router (not Pages Router)
- **Entry point**: `app/page.tsx`
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Language**: TypeScript

The key config detail: `next.config.js` calls `loadEnvConfig` on the parent directory so that the repo-root `.env` is loaded. Without this, `NEXT_PUBLIC_API_BASE_URL` would silently fall back to the default.

#### `components/AppShell.tsx`

The responsive shell component that:
- Manages theme state (light/dark)
- Renders sidebar on desktop, hamburger menu on mobile
- Contains the chat window and document sidebar

#### `components/ChatWindow.tsx`

The main chat interface:
- Displays conversation messages (user and assistant)
- Renders input box for user messages
- Calls `/api/chat` endpoint
- Renders citations as badges below assistant messages
- Maintains session ID for the tab lifetime

#### `components/CitationBadge.tsx`

A small pill component showing `[DocName, p. X]` with a document icon. Clicking it opens the PDF preview modal.

#### `components/PdfPreviewModal.tsx`

Embeds the citation's `drive_url` in an iframe:
- Shows document name and page number in the header
- Iframe URL includes `#page={page_number}` anchor
- Closes on Escape key or click-outside

#### `components/DocumentSidebar.tsx`

Shows ingested documents and ingest status:
- Lists documents with page counts
- Shows last ingest run's timestamp, counts, and any errors
- Exposes a **Re-ingest** button to trigger `POST /api/ingest`
- Ingest errors are surfaced inline rather than hidden

#### `lib/api.ts`

Typed fetch client reading `NEXT_PUBLIC_API_BASE_URL` from the environment:

```typescript
export async function sendChatMessage(message: string, sessionId: string) {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, session_id: sessionId }),
  })
  return response.json() as ChatResponse
}
```

All four endpoints have typed wrappers:
- `sendChatMessage(message, sessionId)` → `ChatResponse`
- `getDocuments()` → `DocumentsResponse`
- `triggerIngest()` → `IngestResponse`
- `getIngestStatus()` → `IngestStatusResponse`

#### `types/chat.ts`

TypeScript types mirroring the backend's Pydantic schemas exactly. When these drift, `npm run build` catches the contract break at compile time.

### Data Flow

A typical chat interaction:

```
User Types Message
        ↓
ChatWindow.tsx calls sendChatMessage()
        ↓
POST /api/chat { message, session_id }
        ↓
Backend: claude_service.py embeds the message with Gemini
        ↓
qdrant_service.py searches for top 6 similar chunks
        ↓
claude_service.py generates an answer with the retrieved chunks
        ↓
Response { answer, citations[] }
        ↓
ChatWindow.tsx renders answer + CitationBadges
        ↓
User clicks CitationBadge
        ↓
PdfPreviewModal opens with the PDF iframe
        ↓
User reads the cited page
```

---

## Running Locally

### Using Make (Recommended)

The simplest approach. The `Makefile` orchestrates all three services:

```bash
# 1. Install dependencies (one time)
make install

# 2. Start all services (Qdrant, backend, frontend)
make up

# 3. In another terminal, watch logs
make logs

# 4. Trigger the first ingest
make ingest

# 5. Stop everything
make down

# 6. Full reset (removes Qdrant container)
make clean
```

The `make up` command:
- Starts Qdrant in Docker (creates container if needed)
- Waits for Qdrant to be healthy
- Starts the FastAPI backend
- Waits for the backend to be healthy
- Starts the Next.js frontend
- Waits for the frontend to be healthy

If a service is already running on its port, `make up` leaves it alone (idempotent).

### Manual Setup

If you prefer to run services independently:

#### 1. Start Qdrant

```bash
docker run -d --name local-qdrant \
  -p 6333:6333 -p 6334:6334 \
  -v "$(pwd)/qdrant_storage:/qdrant/storage" \
  qdrant/qdrant
```

Verify it's running:
```bash
curl http://localhost:6333/health
# Should return: {"title":"Qdrant"}
```

#### 2. Start the Backend

```bash
cd backend

# Create virtual environment (one time)
python3 -m venv .venv
source .venv/bin/activate  # or `.venv\Scripts\activate` on Windows

# Install dependencies
pip install -e ".[dev]"

# Start the server
uvicorn app.main:app --reload --port 8000
```

The backend requires Qdrant to be running first (it checks connectivity at startup).

Verify it's running:
```bash
curl http://localhost:8000/health
# Should return: {"status":"ok"}
```

Interactive API docs: http://localhost:8000/docs

#### 3. Start the Frontend

In another terminal:

```bash
cd frontend

# Install dependencies (one time)
npm install

# Start development server
npm run dev
```

Open http://localhost:3000 in your browser.

### Verifying Everything Works

Run the verification command:

```bash
make test
```

This runs:
1. Backend tests: `pytest` (17 tests, all mocked)
2. Frontend lint: `npm run lint`
3. Frontend build: `npm run build`

All three must pass before the app is ready for local testing.

---

## Available Commands

All commands are in the `Makefile`. Here's the complete reference:

### Service Orchestration

| Command | Effect |
|---------|--------|
| `make up` | Start Qdrant, backend, and frontend (in order, waiting for each to be healthy) |
| `make down` | Stop all three services (Qdrant container is preserved) |
| `make restart` | Equivalent to `make down && make up` |
| `make stop-qdrant` | Stop Qdrant without stopping the backend and frontend |
| `make status` | Show which services are listening and which ports |
| `make logs` | Tail the backend and frontend logs in real time |

### Setup

| Command | Effect |
|---------|--------|
| `make install` | Install frontend npm dependencies and create the backend virtual environment |
| `make check-env` | Verify `.env` has all required variables (errors if any are missing or empty) |
| `make check-venv` | Verify the backend virtual environment exists and has dependencies |

### Operations

| Command | Effect |
|---------|--------|
| `make ingest` | Trigger a full re-ingest from the Google Drive folder (curl POST) |
| `make test` | Run backend tests, frontend lint, and frontend build |
| `make clean` | Stop all services, remove the Qdrant container, and clean `.run/` (vectors are preserved) |

### Individual Services

If you want to start services individually:

| Command | Effect |
|---------|--------|
| `make up-qdrant` | Start Qdrant only |
| `make up-backend` | Start the FastAPI backend (requires Qdrant to be running) |
| `make up-frontend` | Start the Next.js frontend |

All idempotent — running them multiple times is safe.

---

## Testing

### Backend Tests

Run all backend tests:

```bash
cd backend
pytest
```

Test coverage:

| File | Covers |
|---|---|
| `test_chunking.py` | Page-boundary correctness, overlap arithmetic, blank pages |
| `test_drive_service.py` | Folder restriction on both list and download paths |
| `test_chat.py` | Citation response shape, empty-index behavior |
| `test_gemini_service.py` | Retry logic (retries 429, doesn't retry other errors) |
| `test_claude_service.py` | Model ID, system/user prompt split, thinking-block filtering |

Run a specific test file:

```bash
pytest tests/test_chunking.py -v
```

Run tests matching a pattern:

```bash
pytest -k "folder_restriction" -v
```

All external SDKs are mocked, so **no network or credentials required** to run tests.

### Frontend Lint and Build

```bash
cd frontend

# Lint (ESLint)
npm run lint

# Build (Next.js)
npm run build
```

Both must pass before deployment.

---

## Project Status

### ✅ What Works

- **Backend architecture**: FastAPI app boots successfully, all endpoints registered
- **Qdrant integration**: Collection auto-creates on startup
- **Google Drive authentication**: Service account setup and folder restriction work against the real API
- **Frontend rendering**: All components render correctly
- **Backend-frontend integration**: Frontend correctly wired to backend; CORS working
- **Tests**: 17/17 backend tests pass; frontend lint and build pass

### ⚠️ End-to-End Status

**Not yet verified end-to-end**: The application has not been tested with real documents ingested and citations generated.

The blocking issue: The Gemini API project currently returns `403 PERMISSION_DENIED — Your project has been denied access`, which prevents embeddings from working. This is an account-level Google permission issue requiring Google support, not a code defect.

- **Generation** now runs on Claude (working)
- **Embeddings** blocked until the Gemini project is re-enabled
- Once Gemini is enabled, the full RAG pipeline should work

### 🚧 Known Rough Edges

- **Ingest is synchronous and full-refresh**: Every `POST /api/ingest` re-embeds every document. Incremental ingest keyed on Drive `modifiedTime` would be better.
- **Ingest status is in-memory**: Resets on backend restart. Persisting to a database would improve reliability.
- **No conversation history**: `session_id` is accepted but ignored. Each turn is independent (stateless).
- **Two API key providers**: The app requires both Gemini (embeddings) and Anthropic (generation) API keys.

---

## Troubleshooting

### Services Won't Start

**Error**: `ERROR: .env is missing`

**Solution**:
```bash
cp .env.example .env
# Edit .env and fill in your API keys
```

**Error**: `ERROR: .env is missing required keys: GEMINI_API_KEY CLAUDE_API_KEY ...`

**Solution**:
Make sure all variables from `.env.example` are set in `.env`. At minimum, these must be present:
- `GEMINI_API_KEY`
- `CLAUDE_API_KEY`
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `QDRANT_URL`
- `QDRANT_COLLECTION`

### Qdrant Connection Failed

**Error**: `Connection refused` or `Failed to create collection`

**Solution**:
1. Verify Docker is running: `docker ps`
2. Verify Qdrant is listening: `curl http://localhost:6333/health`
3. If Qdrant is not running, start it manually:
   ```bash
   docker run -d --name local-qdrant -p 6333:6333 -p 6334:6334 \
     -v "$(pwd)/qdrant_storage:/qdrant/storage" qdrant/qdrant
   ```

### Backend Won't Start

**Error**: `Address already in use` on port 8000

**Solution**:
Either kill the process on that port or change the port:
```bash
# Kill whatever's on :8000
lsof -ti tcp:8000 | xargs kill -9

# Or run on a different port
cd backend && .venv/bin/uvicorn app.main:app --port 8001
```

**Error**: `ModuleNotFoundError: No module named 'app'`

**Solution**:
Reinstall dependencies:
```bash
cd backend
.venv/bin/pip install -e ".[dev]"
```

### Frontend Won't Start

**Error**: `Port 3000 already in use`

**Solution**:
```bash
lsof -ti tcp:3000 | xargs kill -9
cd frontend && npm run dev
```

**Error**: `Cannot find module '@next/env'`

**Solution**:
Reinstall dependencies:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Google Drive Not Found

**Error**: `403 Forbidden` when accessing Google Drive

**Solution**:
1. Verify the service account email is correct
2. Verify the target folder is shared with the service account as **Viewer**
3. Verify `GOOGLE_DRIVE_FOLDER_ID` matches the shared folder's ID
4. Verify `GOOGLE_APPLICATION_CREDENTIALS` points to the correct service account JSON

### API Returns Errors

**Error**: `500 Internal Server Error` from `/api/chat` or `/api/ingest`

**Solution**:
Check the backend logs:
```bash
make logs
# or
tail -f .run/backend.log
```

Common causes:
- Missing API key (check `.env`)
- Gemini API disabled (verify in Google Cloud Console)
- Qdrant not running or vectors missing
- Google Drive service account not shared with the folder

### Tests Fail

**Backend tests fail**:

```bash
cd backend
pytest -v
```

If you see import errors, reinstall:
```bash
.venv/bin/pip install -e ".[dev]"
```

**Frontend lint fails**:

```bash
cd frontend
npm run lint -- --fix  # Auto-fix common issues
npm run lint           # Re-check
```

---

## Deployment

This section covers deploying the RAG Agent App to production. The app requires three services: Qdrant, the FastAPI backend, and the Next.js frontend.

### Deployment Architecture

```
┌────────────────────────────────────────┐
│  CDN / Load Balancer                   │
└──────────────────┬─────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
    Frontend   Backend     Qdrant
   (Next.js)  (FastAPI)  (Vector DB)
```

### Prerequisites for Deployment

- Docker (or container registry access)
- Python 3.11+ (for backend)
- Node.js 18+ (for frontend)
- API keys (Gemini, Anthropic) set as environment variables
- Google Drive service account JSON
- Persistent storage for Qdrant vectors

### Environment Variables for Production

Set these as environment variables or in your deployment platform's secrets manager:

```bash
GEMINI_API_KEY=your-production-key
CLAUDE_API_KEY=your-production-key
GOOGLE_DRIVE_FOLDER_ID=your-production-folder-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=drive_documents
BACKEND_CORS_ORIGINS=https://yourdomain.com
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

### Option 1: Docker Compose

Create a `docker-compose.prod.yml`:

```yaml
version: '3.9'

services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant-storage:/qdrant/storage
    environment:
      - QDRANT_API_KEY=${QDRANT_API_KEY}
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - GOOGLE_DRIVE_FOLDER_ID=${GOOGLE_DRIVE_FOLDER_ID}
      - GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json
      - QDRANT_URL=http://qdrant:6333
      - BACKEND_CORS_ORIGINS=${BACKEND_CORS_ORIGINS}
    volumes:
      - ./backend/service-account.json:/app/service-account.json:ro
    depends_on:
      - qdrant
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  qdrant-storage:
```

Deploy with:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: Heroku

1. **Create a Heroku app**:
   ```bash
   heroku create your-app-name
   ```

2. **Add PostgreSQL** (for persistent storage, optional):
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

3. **Set environment variables**:
   ```bash
   heroku config:set GEMINI_API_KEY=your-key
   heroku config:set CLAUDE_API_KEY=your-key
   # ... set all other variables
   ```

4. **Deploy**:
   ```bash
   git push heroku main
   ```

### Option 3: Railway

Railway can automatically deploy from GitHub:

1. Connect your GitHub repo to Railway
2. Set environment variables in the Railway dashboard
3. Railway auto-deploys on push to `main`

### Option 4: AWS (ECS Fargate)

Use AWS Elastic Container Service for container orchestration:

1. Create ECR repositories for backend and frontend
2. Push Docker images to ECR
3. Create ECS task definitions
4. Launch Fargate services
5. Use RDS for Qdrant persistence (or self-hosted Qdrant on EC2)

### Option 5: Google Cloud Run

Google Cloud Run is serverless and great for the backend:

1. **Deploy backend to Cloud Run**:
   ```bash
   cd backend
   gcloud run deploy rag-agent-backend \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

2. **Set environment variables** in Cloud Run's configuration

3. **Deploy frontend** to Cloud Storage + Cloud CDN or Vercel

### Scaling Considerations

- **Qdrant**: Self-hosted on a dedicated VM or managed Qdrant Cloud (https://cloud.qdrant.io)
- **Backend**: Stateless, horizontally scalable. Use load balancer in front.
- **Frontend**: Can be cached on CDN (Cloudflare, AWS CloudFront, etc.)

### Monitoring & Observability

Add logging and alerting:

- Backend logs: Use structured logging (e.g., `structlog`)
- Metrics: Instrument API endpoints (latency, error rate, throughput)
- Health checks: `/health` endpoint should be monitored
- Alerts: Set up alerts for backend/Qdrant down, high error rate

---

## Contributing

This is a personal project, but contributions are welcome. Please follow these guidelines:

1. **Create a feature branch**: `git checkout -b feat/your-feature`
2. **Make your changes** on the feature branch
3. **Run tests locally**: `make test`
4. **Submit a pull request** with a clear description

### Code Style

- **Backend**: Follow PEP 8 (enforced by linting)
- **Frontend**: ESLint config in `.eslintrc.json`

### Testing

Before submitting a PR:

```bash
# Backend tests
cd backend && pytest

# Frontend lint and build
cd frontend && npm run lint && npm run build
```

All tests must pass.

---

## License

This project is provided as-is for educational and development purposes.

---

## Support

If you have questions or run into issues:

1. **Check Troubleshooting** above
2. **Check backend logs**: `make logs`
3. **Check the API docs**: http://localhost:8000/docs (when running locally)
4. **Open an issue** on GitHub (if applicable to your setup)

---

**Last Updated**: September 9, 2024
