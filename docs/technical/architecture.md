# Technical Architecture — Sherlock Scraper

### 1. Identificação do Documento

- **Project Name:** Sherlock Scraper
- **Project Type:** split-front-back / worker-automation / ai-automation-platform
- **Project Slug:** sherlock-scraper
- **Client Name:** Moacir
- **Status do projeto:** active
- **Versão desta documentação:** 2.0
- **Última atualização:** 2026-04-14
- **Responsável pela atualização:** Orchestrator (Antigravity)

---

### 2. Resumo Arquitetural

O Sherlock Scraper é um monorepo poliglota para prospecção, enriquecimento e abordagem automatizada de leads B2B.

**Stack por serviço:**

| Serviço | Tecnologia | Responsabilidade |
|---------|-----------|-----------------|
| `backend/` | Go (Fiber v2, GORM, Asynq) | API REST, workers assíncronos, integrações |
| `whatsmeow/` | Go (WhatsMeow, Fiber v2) | CRM WhatsApp — chamado "WhatsMiau" ou "Deus do sistema" |
| `frontend/` | TypeScript, Vite, React | Dashboard Sherlock CRM |
| `whatsmeow/frontend/` | TypeScript, Vite, React | Dashboard WhatsMiau |
| Scrapers (Python) | Python | Busca Google Places, CNPJ bridge API |
| PostgreSQL | — | Persistência relacional de leads, settings, pipeline |
| Redis | — | Filas Asynq, Pub/Sub SSE, cache de sessões WhatsApp |

**Regra arquitetural fundamental:**
O módulo `whatsmeow/` (WhatsMiau) é o **Deus do sistema** — nunca deve ser modificado diretamente pelo Sherlock backend. A comunicação é exclusivamente via HTTP (API REST do WhatsMiau).

---

### 3. Estrutura de Pastas

```
sherlock-scraper/
├── backend/              # API Go + workers Asynq
│   ├── cmd/api/main.go   # Entrypoint — wires deps + rotas
│   ├── internal/
│   │   ├── core/domain/  # Entidades (Lead, Pipeline, Dossier…)
│   │   ├── core/ports/   # Interfaces de serviços e repositórios
│   │   ├── handlers/     # Handlers Fiber (HTTP + SSE)
│   │   ├── services/     # Lógica de negócio
│   │   ├── repositories/ # GORM — acesso ao banco
│   │   ├── queue/        # Asynq tasks, workers, Redis pub/sub
│   │   ├── database/     # GORM connect + AutoMigrate
│   │   ├── middlewares/  # JWT, InternalAuth
│   │   └── sse/          # Hub SSE in-memory (Kanban)
│   └── pkg/              # Utilitários (phoneutil…)
├── whatsmeow/            # CRM WhatsApp — não modificar diretamente
├── frontend/             # Dashboard Sherlock
└── docs/                 # Documentação do projeto
```

---

### 4. Backend — Workers Asynq

O backend usa **Asynq** (Redis-based) para processamento assíncrono. Todos os workers rodam na mesma goroutine em background (`go queue.StartServer()` em `main.go`).

| Task | Constante | Responsabilidade |
|------|-----------|-----------------|
| `enrich:lead` | `TaskTypeEnrichLead` | Enriquece lead: CNPJ, website, Google Reviews, Instagram, Facebook |
| `lead:bulk-message` | `TaskTypeBulkMessage` | Dispara mensagem WhatsApp em massa via WhatsMiau |
| `dossier:analyze` | `TaskTypeDossierAnalyze` | Pipeline deep research: Google Maps → website → redes sociais → LLM |

**Registros em:** `internal/queue/server.go`

---

### 5. SSE — Server-Sent Events

O sistema usa dois mecanismos SSE independentes:

#### 5.1 SSE Kanban (in-memory)
- **Hub:** `internal/sse/hub.go` — `sse.NewHub()`
- **Canal:** in-memory (goroutine)
- **Evento:** movimentação de lead no Kanban
- **Rota:** `GET /api/v1/events/kanban`

#### 5.2 SSE de Campanhas (Redis Pub/Sub)
- **Canal Redis:** `campaigns:logs:<campaign_id>`
- **Publisher:** `queue.PublishCampaignEvent()` em `internal/queue/redis.go`
- **Handler:** `internal/handlers/campaign_sse_handler.go`
- **Rota:** `GET /api/v1/campaigns/:id/stream`

#### 5.3 SSE de Dossier (Redis Pub/Sub)
- **Canal Redis:** `dossier:logs:<lead_id>` — exclusivo por lead
- **Publisher:** `queue.PublishDossierEvent()` em `internal/queue/redis.go`
- **Handler:** `internal/handlers/dossier_handler.go`
- **Rota:** `GET /api/v1/leads/:id/dossier/stream`
- **Eventos:** `{ "stage": "maps|website|social|llm", "status": "running|done|error", "message": "..." }`

**Padrão SSE Redis:** cada conexão SSE cria um client Redis dedicado (go-redis entra em modo Pub/Sub exclusivo). Heartbeat a cada 30s. Goroutine receptora fechada ao desconectar.

---

### 6. Pipeline Dossier Deep Research

Fluxo do worker `dossier:analyze`:

```
POST /api/v1/leads/:id/dossier
  → DossierHandler.Enqueue()
    → Asynq enfileira dossier:analyze
      → HandleDossierAnalyzeTask()
        → DossierService.RunPipeline()
          → investigateMaps()     [Google Places API REST]
          → investigateWebsite()  [HTTP fetch + ExtractSocialAndTracking]
          → investigateSocial()   [Playwright — Instagram + Facebook]
          → saveDossierData()     [dossier_data jsonb]
          → generateAnalysis()    [Gemini REST gemini-2.5-flash]
          → saveDossierAnalysis() [dossier_analysis text]
```

Cada etapa publica evento SSE no canal `dossier:logs:<lead_id>`. Falha em qualquer etapa não aborta o pipeline (graceful degradation).

---

### 7. Módulo WhatsMiau — Agente Super Vendedor

O WhatsMiau (`whatsmeow/`) contém o agente de IA para resposta automática de leads via WhatsApp:

```
WA event → event_emitter.go
  → chatJobChan
    → chat_worker.go / processMessageJob()
      → SalesAgentService.ProcessIncoming()
        → getCompanyIDByInstance() [Redis]
        → loadAgentSettings()      [company_ai_settings]
        → isChatAIPaused()         [chats.ai_paused]
        → loadChatHistory()        [últimas 15 msgs]
        → findLeadByPhone()        [leads.ai_analysis]
        → callGemini()             [REST gemini-2.5-flash]
        → sendReply() OU pauseChat() + HandoffHub SSE
```

**Handoff humano:** quando `acionar_humano: true`, o chat é pausado (`ai_paused=true`) e um evento SSE é emitido via `HandoffHub`. Reset manual pendente (Fase 2).

---

### 8. Rotas HTTP — Backend (resumo)

**Públicas (sem JWT):**

| Método | Rota | Handler |
|--------|------|---------|
| POST | `/api/v1/leads/bulk-send` | `LeadHandler.BulkSend` |
| GET | `/api/v1/campaigns/:id/stream` | `CampaignSSEHandler.Stream` |
| POST | `/api/v1/leads/:id/dossier` | `DossierHandler.Enqueue` |
| GET | `/api/v1/leads/:id/dossier/stream` | `DossierHandler.Stream` |

**Protegidas (JWT obrigatório):**

| Método | Rota | Handler |
|--------|------|---------|
| GET | `/api/v1/protected/leads` | `LeadHandler.GetLeads` |
| POST | `/api/v1/protected/leads/:id/analyze` | `AIHandler.AnalyzeLead` |
| POST | `/api/v1/protected/leads/:id/enrich-cnpj` | `CNPJHandler.EnrichCNPJ` |
| GET | `/api/v1/protected/pipeline` | `PipelineHandler.GetPipeline` |
| GET | `/api/v1/events/kanban` | `SSEHandler.Stream` |
| … | | |

**Internas (X-Internal-Token):**

| Método | Rota | Handler |
|--------|------|---------|
| POST | `/api/v1/internal/scrape-sync` | `ScrapeHandler.StartSync` |
| POST | `/api/v1/internal/scrape-start` | `ScrapeHandler.StartAsync` |

---

### 9. Integrações Externas

| Serviço | Uso | Env |
|---------|-----|-----|
| Google Places API | Google Reviews + place_id (etapa `maps` do dossier e `enrich:lead`) | `GOOGLE_PLACES_API_KEY` |
| Gemini REST API | Análise de leads, agente Super Vendedor, dossier LLM | `GEMINI_API_KEY` |
| WhatsMiau HTTP API | Disparo de mensagens WhatsApp (bulk-send, agente) | `WHATSMIAU_API_URL` |
| Container Python `sherlock:8000` | Bridge CNPJ (`/scrape-cnpj`) | — |
| Playwright (Chromium) | Scraping Instagram e Facebook | `/usr/bin/chromium-browser` |

---

### 10. Auth e Segurança

- **JWT:** `middlewares.Protected()` — rotas do painel Sherlock
- **InternalAuth:** header `X-Internal-Token` — comunicação server-to-server (scrapers → backend)
- **SSE:** rotas públicas (sem JWT) — padrão adotado para bypass de containers locais; JWT comentado no código para reativação futura

---

### 11. Kanban Automation (Redis Subscriber)

O backend escuta o canal `whatsapp:messages:received` (publicado pelo WhatsMiau ao receber mensagem) e move o lead para o estágio `contatado` automaticamente.

Broadcaster duplo:
- `sseHub` — notifica o dashboard Sherlock (in-memory SSE)
- `redisBroadcaster` — notifica o painel WhatsMiau via canal `sherlock:leads:kanban_moved`

---

### 12. Decisões Arquiteturais Registradas

| Decisão | Escolha | Data |
|---------|---------|------|
| WhatsMiau como sistema externo | Nunca modificar diretamente; consumir via HTTP | 2026-04-11 |
| Worker de campanhas | Asynq no Sherlock backend consome WhatsMiau via HTTP | 2026-04-11 |
| SSE de dossier | Redis Pub/Sub (mesmo padrão de campanhas) | 2026-04-14 |
| Scraping dossier | HTTP puro (sem chromedp) para Google; Playwright para social | 2026-04-14 |
| LLM do dossier | REST API Gemini (sem Go SDK) — evita typo em `ai_service.go` | 2026-04-14 |
| Modelo Gemini | `gemini-2.5-flash` em todo o projeto (sales_agent, gemini.go, dossier) | 2026-04-14 |
