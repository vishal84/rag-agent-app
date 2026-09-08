# CLAUDE.md - Project Directives & Architectural Spec

## Core Operating Principles
1. **Spec-First Enforcement**: Never generate core code without reading `specs/active-feature.md`.
2. **Branch Hygiene**: All feature generation must take place on isolated `feat/` branches.
3. **MCP Boundaries**: The frontend strictly interfaces with the backend server; the backend interacts with Google Drive and Qdrant via MCP tools.

## Architecture Specifications
- **Frontend**: Next.js 14+ (App Router), React, Tailwind CSS, Lucide Icons.
- **Backend API**: Python FastAPI exposing REST endpoints for the UI, consuming local MCP endpoints.
- **Embeddings**: Gemini `gemini-embedding-001` (3072-dim) via Google GenAI SDK.
- **Generation**: Claude `claude-sonnet-5` via the Anthropic SDK. Anthropic has no embeddings
  endpoint, so the embedding and generation providers are deliberately different.
- **Vector DB**: Local Qdrant instance (`http://localhost:6333`).
- **Google Drive Integration**: Fixed Target Folder ID: `1RxJbIKBJ1SfiPO4wj4skXbxgaIYguUO4`.

## Environment Variables
Environment variables are defined in `.env` (gitignored, local values) with `.env.example` as the checked-in template. Required variables:
- `GEMINI_API_KEY`: Your Gemini API key (embeddings).
- `CLAUDE_API_KEY`: Your Anthropic API key (answer generation).
- `GOOGLE_DRIVE_FOLDER_ID`: Target Google Drive folder ID.
- `QDRANT_URL`: Local Qdrant instance URL.

## Verification Commands
- `npm run lint` & `npm run build` (Frontend)
- `pytest` (Backend)