# rag-agent-app — local service orchestration
#
# Three processes, started in this order: Qdrant (Docker) -> FastAPI -> Next.js.
# The order is required: app/main.py registers a startup hook that calls Qdrant
# immediately, so uvicorn aborts if port 6333 is closed.
#
#   make up     start everything
#   make down   stop everything
#   make help   list every target

SHELL := /bin/bash

QDRANT_CONTAINER := local-qdrant
QDRANT_PORT      := 6333
QDRANT_GRPC_PORT := 6334
QDRANT_URL       := http://localhost:$(QDRANT_PORT)/
BACKEND_PORT     := 8000
BACKEND_URL      := http://localhost:$(BACKEND_PORT)
FRONTEND_PORT    := 3000
FRONTEND_URL     := http://localhost:$(FRONTEND_PORT)

RUN_DIR := .run
VENV    := backend/.venv
ENV_FILE := .env

# Declared without defaults in backend/app/config.py — absence is a pydantic
# ValidationError at import, so the backend cannot even start.
REQUIRED_VARS := GEMINI_API_KEY CLAUDE_API_KEY GOOGLE_DRIVE_FOLDER_ID \
                 QDRANT_URL QDRANT_COLLECTION GOOGLE_APPLICATION_CREDENTIALS

# These boot fine when absent but break the app at request time: an empty
# BACKEND_CORS_ORIGINS blocks every browser call from :3000.
ADVISORY_VARS := BACKEND_CORS_ORIGINS NEXT_PUBLIC_API_BASE_URL

# Poll $(1) until it answers, labelled $(2). Fails after 60s rather than hanging.
define wait_http
	@printf '  waiting for %s ' '$(2)'; \
	for i in $$(seq 1 60); do \
	  if curl -fsS -o /dev/null '$(1)' 2>/dev/null; then echo ' ready'; exit 0; fi; \
	  printf '.'; sleep 1; \
	done; \
	echo ' TIMEOUT'; \
	echo "  $(2) did not come up within 60s. Check 'make logs'."; \
	exit 1
endef

# Kill whatever holds port $(1), labelled $(2). Safe when nothing is listening.
define stop_port
	@if lsof -ti tcp:$(1) >/dev/null 2>&1; then \
	  lsof -ti tcp:$(1) | xargs kill 2>/dev/null || true; \
	  sleep 1; \
	  lsof -ti tcp:$(1) | xargs kill -9 2>/dev/null || true; \
	  echo '  $(2) stopped'; \
	else \
	  echo '  $(2) not running'; \
	fi
endef

# Report whether port $(1) is listening, labelled $(2).
define report_port
	@if lsof -ti tcp:$(1) >/dev/null 2>&1; then \
	  printf '  %-6s %-9s :%s\n' 'UP' '$(2)' '$(1)'; \
	else \
	  printf '  %-6s %-9s :%s\n' 'DOWN' '$(2)' '$(1)'; \
	fi
endef

.DEFAULT_GOAL := help
.PHONY: help install up up-qdrant up-backend up-frontend down stop-qdrant \
        restart status logs ingest test clean check-env check-venv

help:
	@echo 'rag-agent-app — local services'
	@echo
	@echo '  make up          start Qdrant, the backend and the frontend'
	@echo '  make down        stop all three (Qdrant container is kept)'
	@echo '  make restart     down, then up'
	@echo '  make status      show which services are listening'
	@echo '  make logs        tail the backend and frontend logs'
	@echo
	@echo '  make install     install frontend and backend dependencies'
	@echo '  make ingest      trigger a Google Drive ingest'
	@echo '  make test        backend pytest, then frontend lint and build'
	@echo '  make clean       down, remove the Qdrant container and $(RUN_DIR)/'
	@echo
	@echo '  Individual services: up-qdrant, up-backend, up-frontend'

# --- dependencies ------------------------------------------------------------

install:
	@echo '==> frontend dependencies'
	npm install
	@echo '==> backend virtualenv'
	@if [ ! -x "$(VENV)/bin/python" ]; then \
	  echo '  creating $(VENV)'; \
	  python3 -m venv $(VENV); \
	fi
	cd backend && .venv/bin/pip install -e ".[dev]"
	@echo '==> done. Run: make up'

# --- preflight ---------------------------------------------------------------

check-env:
	@if [ ! -f '$(ENV_FILE)' ]; then \
	  echo 'ERROR: $(ENV_FILE) is missing. Copy .env.example to .env and fill it in.'; \
	  exit 1; \
	fi
	@missing=''; \
	for var in $(REQUIRED_VARS); do \
	  if ! grep -qE "^[[:space:]]*$$var=" '$(ENV_FILE)'; then missing="$$missing $$var"; fi; \
	done; \
	if [ -n "$$missing" ]; then \
	  echo "ERROR: $(ENV_FILE) is missing required keys:$$missing"; \
	  echo '  The backend raises a ValidationError at import if any key is absent.'; \
	  exit 1; \
	fi; \
	empty=''; \
	for var in $(ADVISORY_VARS); do \
	  if ! grep -qE "^[[:space:]]*$$var=." '$(ENV_FILE)'; then empty="$$empty $$var"; fi; \
	done; \
	if [ -n "$$empty" ]; then \
	  echo "  WARNING: empty or absent:$$empty — the app boots but browser calls may fail"; \
	fi
	@echo '  .env OK (presence only — empty keys boot and then fail at request time)'

check-venv:
	@if [ ! -x '$(VENV)/bin/uvicorn' ]; then \
	  echo 'ERROR: $(VENV) is missing or incomplete. Run: make install'; \
	  exit 1; \
	fi

# --- start -------------------------------------------------------------------

up: check-env check-venv up-qdrant up-backend up-frontend
	@echo
	@echo 'All services are up:'
	@echo '  frontend  $(FRONTEND_URL)'
	@echo '  backend   $(BACKEND_URL)   (docs at $(BACKEND_URL)/docs)'
	@echo '  qdrant    http://localhost:$(QDRANT_PORT)'
	@echo
	@echo "Logs: make logs   Stop: make down"

up-qdrant:
	@echo '==> qdrant'
	@if [ -n "$$(docker ps -q -f name=^/$(QDRANT_CONTAINER)$$)" ]; then \
	  echo '  already running'; \
	elif [ -n "$$(docker ps -aq -f name=^/$(QDRANT_CONTAINER)$$)" ]; then \
	  docker start $(QDRANT_CONTAINER) >/dev/null && echo '  container started'; \
	else \
	  echo '  creating container'; \
	  docker run -d --name $(QDRANT_CONTAINER) \
	    -p $(QDRANT_PORT):$(QDRANT_PORT) -p $(QDRANT_GRPC_PORT):$(QDRANT_GRPC_PORT) \
	    -v "$(CURDIR)/qdrant_storage:/qdrant/storage" qdrant/qdrant >/dev/null; \
	fi
	$(call wait_http,$(QDRANT_URL),qdrant)

up-backend: check-env check-venv up-qdrant
	@echo '==> backend'
	@if lsof -ti tcp:$(BACKEND_PORT) >/dev/null 2>&1; then \
	  echo '  already listening on :$(BACKEND_PORT)'; \
	else \
	  mkdir -p $(RUN_DIR); \
	  ( cd backend && exec .venv/bin/uvicorn app.main:app --port $(BACKEND_PORT) \
	    > '$(CURDIR)/$(RUN_DIR)/backend.log' 2>&1 ) & \
	  echo $$! > '$(RUN_DIR)/backend.pid'; \
	  echo '  started, logging to $(RUN_DIR)/backend.log'; \
	fi
	$(call wait_http,$(BACKEND_URL)/health,backend)

up-frontend:
	@echo '==> frontend'
	@if lsof -ti tcp:$(FRONTEND_PORT) >/dev/null 2>&1; then \
	  echo '  already listening on :$(FRONTEND_PORT)'; \
	else \
	  mkdir -p $(RUN_DIR); \
	  ( exec npm run dev > '$(RUN_DIR)/frontend.log' 2>&1 ) & \
	  echo $$! > '$(RUN_DIR)/frontend.pid'; \
	  echo '  started, logging to $(RUN_DIR)/frontend.log'; \
	fi
	$(call wait_http,$(FRONTEND_URL),frontend)

# --- stop --------------------------------------------------------------------

down:
	@echo '==> stopping services'
	$(call stop_port,$(FRONTEND_PORT),frontend)
	$(call stop_port,$(BACKEND_PORT),backend)
	@$(MAKE) --no-print-directory stop-qdrant
	@rm -f '$(RUN_DIR)/backend.pid' '$(RUN_DIR)/frontend.pid'
	@echo 'Done. Ingested vectors are preserved; use "make clean" for a full reset.'

stop-qdrant:
	@if [ -n "$$(docker ps -q -f name=^/$(QDRANT_CONTAINER)$$)" ]; then \
	  docker stop $(QDRANT_CONTAINER) >/dev/null && echo '  qdrant stopped'; \
	else \
	  echo '  qdrant not running'; \
	fi

restart:
	@$(MAKE) --no-print-directory down
	@$(MAKE) --no-print-directory up

# --- inspect -----------------------------------------------------------------

status:
	@echo 'services:'
	$(call report_port,$(FRONTEND_PORT),frontend)
	$(call report_port,$(BACKEND_PORT),backend)
	$(call report_port,$(QDRANT_PORT),qdrant)

logs:
	@mkdir -p $(RUN_DIR)
	@touch '$(RUN_DIR)/backend.log' '$(RUN_DIR)/frontend.log'
	tail -f '$(RUN_DIR)/backend.log' '$(RUN_DIR)/frontend.log'

# --- tasks -------------------------------------------------------------------

# Ingest never raises: a failure returns HTTP 200 with an "error" field.
ingest:
	@echo '==> ingesting from the Drive folder in GOOGLE_DRIVE_FOLDER_ID'
	@curl -sS -X POST '$(BACKEND_URL)/api/ingest'
	@echo

test: check-venv
	@echo '==> backend tests'
	cd backend && .venv/bin/pytest
	@echo '==> frontend lint and build'
	npm run lint
	npm run build

clean:
	@$(MAKE) --no-print-directory down
	@echo '==> removing the qdrant container'
	@if [ -n "$$(docker ps -aq -f name=^/$(QDRANT_CONTAINER)$$)" ]; then \
	  docker rm $(QDRANT_CONTAINER) >/dev/null && echo '  removed'; \
	else \
	  echo '  nothing to remove'; \
	fi
	@rm -rf '$(RUN_DIR)'
	@echo 'Done. qdrant_storage/ was left untouched.'
