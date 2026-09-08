# CLAUDE.md - Project Directives & Architectural Spec

## Core Operating Principles
1. **Spec-First Enforcement**: Never generate core code without reading `specs/active-feature.md`.
2. **Branch Hygiene**: All feature generation must take place on isolated `feat/` branches.
3. **MCP Boundaries**: The frontend strictly interfaces with the backend server; the backend interacts with Google Drive and Qdrant via MCP tools.

## Architecture Specifications
- **Frontend**: Next.js 14+ (App Router), React, Tailwind CSS, Lucide Icons.
- **Backend API**: Python FastAPI exposing REST endpoints for the UI, consuming local MCP endpoints.
- **Embeddings**: Gemini `text-embedding-004` model via Google GenAI SDK.
- **Vector DB**: Local Qdrant instance (`http://localhost:6333`).
- **Google Drive Integration**: Fixed Target Folder ID: `1RxJbIKBJ1SfiPO4wj4skXbxgaIYguUO4`.

## Environment Variables
- `GEMINI_API_KEY`: `AIzaSyAzbBtYPJf-5COuYWVYMY5kQ_DjQoS7mKs`
- `GOOGLE_DRIVE_FOLDER_ID`: `1RxJbIKBJ1SfiPO4wj4skXbxgaIYguUO4`
- `QDRANT_URL`: `http://localhost:6333`

## Verification Commands
- `npm run lint` & `npm run build` (Frontend)
- `pytest` (Backend)