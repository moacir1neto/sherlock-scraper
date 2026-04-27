# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Start all services
```bash
docker compose up -d --build
```

### Seed admin user
```bash
docker compose exec api go run cmd/seed/main.go
```

### Backend (Go) — run locally
```bash
cd backend && go run cmd/api/main.go
```

### Frontend (Sherlock) — run locally
```bash
cd frontend && npm run dev
```

### Frontend (WhatsMiau) — run locally
```bash
cd whatsmeow/frontend && npm run dev
```

### Backend Go build
```bash
cd backend && go build ./...
```

## Architecture

Polyglot monorepo. Each service has a distinct role:

| Directory | Language | Role |
|-----------|----------|------|
| `backend/` | Go (Fiber v2, GORM, Asynq) | Core CRM API + async workers |
| `whatsmeow/` | Go (WhatsMeow, Fiber v2) | WhatsApp gateway (WhatsMiau) |
| `frontend/` | TypeScript + React + Vite | Sherlock dashboard |
| `whatsmeow/frontend/` | TypeScript + React + Vite | WhatsMiau dashboard |
| Root Python files | Python | CNPJ scraping (`bridge_api.py`, `cnpj_scraper.py`) |
| PostgreSQL | — | Leads, pipeline, settings |
| Redis | — | Asynq queue backing + Pub/Sub for SSE |

**Critical rule:** `whatsmeow/` is a self-contained system ("Deus do sistema"). The Sherlock `backend/` communicates with it exclusively via HTTP REST. Never touch `whatsmeow/` internals when working on backend features.

## Backend Internal Structure (`backend/internal/`)

```
core/domain/    — Entities (Lead, Pipeline, Dossier…)
core/ports/     — Repository and service interfaces
handlers/       — Fiber HTTP handlers
services/       — Business logic
repositories/   — GORM DB access
queue/          — Asynq task definitions, workers, Redis pub/sub
database/       — GORM connect + AutoMigrate
middlewares/    — JWT (Protected), InternalAuth (X-Internal-Token)
sse/            — In-memory SSE hub (Kanban)
```

## Async Workers (Asynq)

Three task types registered in `internal/queue/server.go`:

- `enrich:lead` — enriches lead with CNPJ, website, Google Reviews, social links
- `lead:bulk-message` — bulk WhatsApp send via WhatsMiau HTTP API
- `dossier:analyze` — deep research pipeline: Google Maps → website scrape → Playwright social → Gemini LLM

## SSE Patterns

Two independent SSE mechanisms:

1. **Kanban SSE** (`internal/sse/hub.go`) — in-memory goroutine channel, route `GET /api/v1/events/kanban`
2. **Campaigns SSE** — Redis Pub/Sub channel `campaigns:logs:<campaign_id>`, route `GET /api/v1/campaigns/:id/stream`
3. **Dossier SSE** — Redis Pub/Sub channel `dossier:logs:<lead_id>`, route `GET /api/v1/leads/:id/dossier/stream`

Each Redis SSE connection creates a dedicated go-redis client. Heartbeat every 30s.

## Auth

- **JWT:** `middlewares.Protected()` — Sherlock dashboard routes (`/api/v1/protected/…`)
- **InternalAuth:** `X-Internal-Token` header — server-to-server (Python scrapers → Go API)
- **SSE routes:** currently public (JWT bypass intentional for Docker networking — commented code exists to re-enable)

## External Integrations

| Service | Env var | Usage |
|---------|---------|-------|
| Google Places API | `GOOGLE_PLACES_API_KEY` | Maps data in `enrich:lead` and dossier pipeline |
| Gemini REST API (`gemini-2.5-flash`) | `GEMINI_API_KEY` | Lead analysis, sales agent, dossier LLM |
| WhatsMiau HTTP API | `WHATSMIAU_API_URL` | WhatsApp message dispatch |
| Python CNPJ container | internal `sherlock:8000` | `/scrape-cnpj` bridge endpoint |
| Playwright/Chromium | path `/usr/bin/chromium-browser` | Instagram + Facebook scraping |

The model used across the entire project is `gemini-2.5-flash`. Do not change it without explicit instruction.

## Service Ports (Docker)

| Service | Host port |
|---------|-----------|
| Python scraper | 8000 |
| Go API (backend) | 3005 |
| Frontend (Sherlock) | 5173 |
| WhatsMiau API | 8081 |
| WhatsMiau UI | 3031 |
| PostgreSQL | 5434 |
| Redis | 6379 |

## Agent Rules

- Frases curtas, sem enrolação ou introdução.
- Execute ferramentas primeiro, mostre resultado, depois pare.
- Nunca adivinhe caminhos de arquivo ou nomes de função — verifique o código real.
- Toda comunicação do Sherlock backend com o WhatsMiau é exclusivamente via HTTP.
