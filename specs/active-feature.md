# Feature Specification: RAG Agentic Chat UI with Page Level Drive Citations

> In-flight companion spec: [Material Design 3 UI with Responsive Layout](./material-design-ui.md) — frontend presentation only, no change to the criteria below.

## 1. Goal & Requirements
- Focus: Build an end-to-end agentic chat app with page-level Drive PDF citations.
- Scope: Ingest files ONLY from target folder `1RxJbIKBJ1SfiPO4wj4skXbxgaIYguUO4`.
- Stack: Gemini Embeddings + Claude Generation + Local Qdrant Vector Store + Next.js UI.

## 2. Component Blueprint
- **Agent Framework (ADK)**: Agents built with ADK 2.0 (graph workflows) and utilizing `agents-cli` which comes with skills that instruct the assistant on how to build ADK agents.
- **MCP Integration**: Fetch PDF streams from Google Drive, extract page metadata.
- **Vector Pipeline**: Chunk texts using Gemini embeddings with `{page_number, file_id, drive_url}` tags into local Qdrant.
- **Answer Generation**: Claude `claude-sonnet-5` composes the grounded answer from retrieved excerpts.
- **Frontend UI**: Citation badges, PDF preview modal highlighting exact page references.

## 3. Acceptance Criteria
- [ ] Only processes files within authorized Google Drive folder (`1RxJbIKBJ1SfiPO4wj4skXbxgaIYguUO4`).
- [ ] Every RAG response contains clickable page-level inline citations `[DocName, p. X]`.
