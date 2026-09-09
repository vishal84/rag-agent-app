---
name: run-rag-agent-app
description: Build, launch, run, start and drive the rag-agent-app locally — Qdrant, the FastAPI backend and the Next.js frontend — and screenshot or test the UI in a real browser. Use when asked to run the app, take a screenshot, reproduce a UI bug, or verify a frontend change at runtime.
---

# Running rag-agent-app

Three processes, started in this order: **Qdrant (Docker) → FastAPI backend → Next.js frontend**. The order is not optional; see Gotchas.

The agent path is `driver.mjs`, which drives the real UI in your installed Chrome via `playwright-core` and asserts responsive, drawer, theme and chat behaviour. All paths below are relative to the repo root.

## Prerequisites

Verified present on macOS with Node v26.8.1, npm 11.19.0, Python 3.13.15, Docker 29.7.2:

- Docker running (for Qdrant)
- Google Chrome at `/Applications/Google Chrome.app` — `driver.mjs` uses `channel: "chrome"` and downloads no browser
- A repo-root `.env` with all six required vars **present** (see Gotchas — empty values still boot)

```bash
cd frontend && npm install        # frontend deps, includes playwright-core
```

## 1. Qdrant

```bash
docker start local-qdrant                       # if the container already exists
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:6333/    # expect 200
```

First time only, creating the container:

```bash
docker run -d --name local-qdrant -p 6333:6333 -p 6334:6334 \
  -v "$(pwd)/qdrant_storage:/qdrant/storage" qdrant/qdrant
```

## 2. Backend

```bash
cd backend && .venv/bin/uvicorn app.main:app --port 8000
```

Add `--reload` for iterative work. Verify from another shell:

```bash
curl -s http://localhost:8000/health          # {"status":"ok"}
curl -s http://localhost:8000/api/documents   # [] until an ingest succeeds
```

Recreate the venv if it is missing or broken:

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
```

## 3. Frontend

```bash
cd frontend && npm run dev        # http://localhost:3000
```

## Run: the driver (agent path)

Both servers must already be up — the driver preflights `/health` and the frontend and exits with a clear message if either is down.

```bash
node .claude/skills/run-rag-agent-app/driver.mjs --flow all --out /tmp/shots
```

Flows, runnable individually with `--flow <name>`:

| Flow | What it proves |
|---|---|
| `shots` | Loads 390 / 768 / 1280px in light and dark, writes 6 PNGs, asserts **no horizontal overflow** and that Material Symbols rendered as glyphs rather than ligature text |
| `chat` | Types a real question, waits up to 90s for the assistant bubble, opens the first citation's PDF modal, closes it with Escape |
| `drawer` | At 390px opens the drawer, asserts body scroll lock, Escape-to-close and focus restored to the trigger, then asserts the menu button is gone at 1280px |
| `theme` | Toggles dark, reloads, asserts the class survives (pre-paint script works) |

Other flags: `--base` (default `http://localhost:3000`), `--api` (default `http://localhost:8000`), `--question`.

Exit code is 0 only when every check passes; failures print as a `FAIL — n problem(s)` list. Console and page errors are collected and reported, with the pre-existing `/favicon.ico` 404 filtered out.

**Look at the PNGs.** A blank or error-page frame is a failed launch, not a pass.

## Seeding data

An empty document list is expected on a fresh Qdrant. Ingest pulls from the Drive folder in `GOOGLE_DRIVE_FOLDER_ID`:

```bash
curl -s -X POST http://localhost:8000/api/ingest
```

It never raises — a failure comes back as `{"status":"error", ..., "error":"..."}` with HTTP 200, and the same string renders in the sidebar.

## Run: human path

Three terminals: `docker start local-qdrant`, then `cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000`, then `cd frontend && npm run dev`. Open `http://localhost:3000`; API docs at `http://localhost:8000/docs`.

## Verification commands

```bash
cd frontend && npm run lint && npm run build   # frontend
cd backend && .venv/bin/pytest    # 17 tests
```

## Gotchas

- **Qdrant must be listening before the backend starts.** `app/main.py` registers an `@app.on_event("startup")` that calls `ensure_qdrant_collection()`, which issues `get_collections()` immediately. If port 6333 is closed, uvicorn aborts during startup instead of serving.
- **All six env vars must be present to boot, but their values are never validated.** `Settings` in `backend/app/config.py` declares them with no defaults, so a missing key is a pydantic `ValidationError` at import. An *empty* key passes, boots fine, and then fails as an HTTP 500 on `/api/chat`. A booting backend is not evidence of working credentials.
- **`.env` is read from the repo root by absolute path** (`REPO_ROOT = parents[2]`), so the backend's launch directory does not matter.
- **`GEMINI_API_KEY` must be a Google AI Studio key beginning `AIza`** (~39 chars). Other Google credential formats are rejected by `generativelanguage.googleapis.com` with `401 ACCESS_TOKEN_TYPE_UNSUPPORTED`, which surfaces as a failed ingest *and* a 500 on every chat, because the query is embedded before retrieval. Test a key without the app:
  ```bash
  curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=$KEY" \
    -H 'Content-Type: application/json' \
    -d '{"model":"models/gemini-embedding-001","content":{"parts":[{"text":"hi"}]}}' | head -c 200
  ```
- **`backend/.venv` is internally inconsistent**: `pyvenv.cfg` says `version = 3.14.7` while the interpreter reports 3.13.15 and packages live in `lib/python3.13/site-packages`. It works — do not "fix" it by reflex — but recreate it if imports start failing.
- **`BACKEND_CORS_ORIGINS` defaults to empty**, which sends no CORS origins and makes browser calls from :3000 fail. It needs `http://localhost:3000`.
- **Ingest needs the Drive folder shared with the service account** in `backend/service-account.json` as Viewer; the account is otherwise authenticated but sees nothing.
- **The app ships no `public/favicon.ico`**, so every page load logs a 404. Harmless; the driver filters it.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| uvicorn exits during startup with a Qdrant connection error | Qdrant is down. `docker start local-qdrant`, wait for `curl localhost:6333` to return 200, retry. |
| `ValidationError` naming a field at backend start | That var is absent from the root `.env`. Presence is enough to boot. |
| `POST /api/chat` returns 500 while `/health` is fine | Bad `GEMINI_API_KEY` or `CLAUDE_API_KEY`. Check `backend.log` for the provider's message; test the Gemini key with the curl above. |
| Ingest returns `status: "error"` with `ACCESS_TOKEN_TYPE_UNSUPPORTED` | `GEMINI_API_KEY` is not an `AIza` AI Studio key. |
| Driver exits `backend not healthy` | The backend is not up, or is on a different port — pass `--api`. |
| Icons render as the words "send", "menu" | The Material Symbols stylesheet did not load (offline). The `shots` flow catches this by measuring icon width. |
