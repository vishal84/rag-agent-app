---
description: Automatically creates a Git feature branch, generates a Spec Kit file, and initializes implementation.
allowed-tools: Bash, WriteFile, ReadFile
---

## Task Instructions
1. Extract the feature title from arguments: `$ARGUMENTS`.
2. Generate a sanitized branch name (e.g., `feat/rag-citation-pipeline`).
3. Run `git checkout -b <branch-name>` to create and switch to the new feature branch.
4. Create the specification file at `specs/active-feature.md` using the template below.
5. Notify the user that the workspace is primed, then wait for final spec review before proceeding to implementation.

## Specification Template (`specs/active-feature.md`)
```markdown
# Feature Specification: $ARGUMENTS

## 1. Goal & Requirements
- Focus: Build an end-to-end agentic chat app with page-level Drive PDF citations.
- Scope: Ingest files ONLY from target folder `1RxJbIKBJ1SfiPO4wj4skXbxgaIYguUO4`.
- Stack: Gemini Embeddings + Local Qdrant Vector Store + Next.js UI.

## 2. Component Blueprint
- **Agent Framework (ADK)**: Agents built with ADK 2.0 (graph workflows) and utilizing `agents-cli` which comes with skills that instruct the assistant on how to build ADK agents.
- **MCP Integration**: Fetch PDF streams from Google Drive, extract page metadata.
- **Vector Pipeline**: Chunk texts using Gemini embeddings with `{page_number, file_id, drive_url}` tags into local Qdrant.
- **Frontend UI**: Citation badges, PDF preview modal highlighting exact page references.

## 3. Acceptance Criteria
- [ ] Only processes files within authorized Google Drive folder (`1RxJbIKBJ1SfiPO4wj4skXbxgaIYguUO4`).
- [ ] Every RAG response contains clickable page-level inline citations `[DocName, p. X]`.
```