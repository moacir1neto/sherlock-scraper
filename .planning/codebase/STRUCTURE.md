---
title: Structure
last_mapped: 2026-05-01
---

# STRUCTURE.md — Layout de Diretórios e Organização

## Raiz do Repositório

```
sherlock-scraper/
├── backend/                   ← Sherlock CRM (Go/Fiber)
├── frontend/                  ← CRM UI (React/Vite/TS)
├── whatsmeow/                 ← WhatsMiau WhatsApp API (Go/Echo)
│   └── frontend/              ← WhatsMiau UI (React/Vite/TS)
├── docs/                      ← Documentação técnica e de negócio
├── .planning/                 ← Planejamento GSD
│   └── codebase/              ← Este mapeamento
├── docker-compose.yml         ← Orquestração completa
├── Dockerfile                 ← Imagem do Python scraper
├── bridge_api.py              ← Bridge Python HTTP
├── cnpj_scraper.py            ← Scraper CNPJ Playwright
└── comandos-gsd.md            ← Referência de comandos GSD
```

---

## Backend CRM (`backend/`)

```
backend/
├── cmd/
│   ├── api/
│   │   └── main.go            ← Entrypoint principal (DI manual, Fiber app)
│   └── seed/
│       └── main.go            ← Seed de dados iniciais
├── internal/
│   ├── core/
│   │   ├── domain/            ← Entidades de domínio
│   │   │   ├── lead.go
│   │   │   ├── pipeline.go
│   │   │   ├── dossier.go
│   │   │   ├── setting.go
│   │   │   ├── user.go
│   │   │   └── processed_message.go
│   │   └── ports/             ← Interfaces (ports hexagonais)
│   │       ├── lead_ports.go
│   │       ├── kanban_ports.go
│   │       ├── user_ports.go
│   │       └── whatsapp_ports.go
│   ├── handlers/              ← Controllers HTTP Fiber
│   │   ├── ai_handler.go
│   │   ├── auth_handler.go
│   │   ├── campaign_sse_handler.go
│   │   ├── cnpj_handler.go
│   │   ├── dossier_handler.go
│   │   ├── lead_handler.go
│   │   ├── pipeline_handler.go
│   │   ├── redis_subscriber.go
│   │   ├── scrape_handler.go
│   │   ├── setting_handler.go
│   │   ├── sse_handler.go
│   │   └── whatsapp_handler.go
│   ├── services/              ← Implementações dos ports
│   │   ├── ai_service.go
│   │   ├── auth_service.go
│   │   ├── cnpj_service.go
│   │   ├── kanban_automation_service.go
│   │   ├── lead_service.go
│   │   └── whatsapp_service.go
│   ├── repositories/          ← Adaptadores GORM
│   │   ├── lead_repository.go
│   │   ├── pipeline_repository.go
│   │   └── user_repository.go
│   ├── queue/                 ← Workers Asynq
│   │   ├── client.go
│   │   ├── server.go
│   │   ├── tasks.go
│   │   ├── dossier_processor.go
│   │   ├── dossier_service.go
│   │   ├── google_scraper.go
│   │   ├── social_scraper.go
│   │   ├── helpers.go
│   │   └── redis.go
│   ├── sse/                   ← SSE Hub
│   │   ├── hub.go
│   │   ├── composite.go
│   │   └── redis_broadcaster.go
│   ├── middlewares/
│   │   ├── auth_middleware.go ← JWT Protection
│   │   └── internal_auth.go  ← X-Internal-Token
│   └── database/
│       └── database.go        ← GORM connection + AutoMigrate
└── pkg/                       ← Packages utilitários reutilizáveis
    ├── csvparser/
    │   └── csv_parser.go
    └── phoneutil/
        └── normalizer.go
```

---

## WhatsMiau (`whatsmeow/`)

```
whatsmeow/
├── main.go                    ← Entrypoint (env load, migrations, Echo, workers)
├── cmd/                       ← (vazio / reservado)
├── env/
│   └── env.go                 ← Struct de config tipada via caarlos0/env
├── server/
│   ├── routes/                ← Registro de rotas Echo
│   │   ├── main.go            ← Load(), V1(), RegisterChatWS()
│   │   ├── admin.go
│   │   ├── ai_settings.go
│   │   ├── auth.go
│   │   ├── chat.go / handoff_sse.go / leads.go
│   │   ├── instance.go / message.go / profile.go
│   │   ├── super_admin.go / user.go / company.go
│   │   └── system_logs_sse.go / sherlock.go
│   ├── controllers/           ← Handlers (thin, delegam para services/repos)
│   │   ├── instance.go        ← Gestão de instâncias WhatsApp
│   │   ├── chat.go            ← Listagem e envio de mensagens
│   │   ├── lead.go            ← CRM de leads
│   │   ├── kanban.go          ← Gestão Kanban
│   │   ├── ai_settings.go     ← Config do agente AI
│   │   ├── auth.go
│   │   ├── company.go / user.go / sector.go / tag.go
│   │   ├── message.go / quick_reply.go / scheduled_message.go
│   │   ├── dashboard.go / audit_log.go / incident.go
│   │   ├── sherlock.go        ← Integração com Sherlock CRM
│   │   └── flow.go / upload.go / webhook_instance.go
│   ├── dto/                   ← Request/Response structs
│   ├── middleware/
│   │   ├── auth.go / jwt.go / auth_or_jwt.go
│   │   ├── admin.go / super_admin.go
│   └── ws/
│       ├── hub.go             ← WebSocket connection manager
│       └── handler.go         ← ServeWS endpoint
├── services/                  ← Lógica de negócio
│   ├── sales_agent.go         ← Super Vendedor AI
│   ├── kanban_automation.go   ← Status automático de leads
│   ├── chat_worker.go         ← Processamento de msgs WhatsApp
│   ├── scheduled_worker.go    ← Agendador de mensagens
│   ├── handoff_hub.go         ← SSE para handoff humano
│   ├── system_log_hub.go      ← SSE para logs do sistema
│   ├── redis_lead_event_publisher.go
│   ├── migrations.go          ← DDL SQL inline
│   ├── db.go / redis.go / sqlstore.go
│   ├── gemini.go / groq_client.go
│   ├── sherlock.go            ← Client HTTP para Sherlock CRM
│   └── incident.go
├── repositories/              ← SQL raw (database/sql)
│   ├── instances/ chats/ messages/ leads/
│   ├── users/ (sql.go + redis.go)
│   └── webhook_logs/
├── interfaces/                ← Contratos Go (ports)
├── lib/
│   └── whatsmiau/             ← Wrapper go.mau.fi/whatsmeow
│       ├── whatsmeow.go       ← Connect, QR, Send
│       ├── chat.go
│       └── event_emitter.go
├── models/                    ← Structs de domínio
├── utils/
│   ├── jwt.go / password.go / http_response.go
├── scripts/                   ← Scripts utilitários Go (criação de usuários)
└── frontend/                  ← WhatsMiau UI
```

---

## Convenções de Nomenclatura

| Tipo | Convenção | Exemplo |
|---|---|---|
| Arquivos Go | snake_case | `sales_agent.go` |
| Pacotes Go | lowercase | `package services` |
| Structs | PascalCase | `SalesAgentService` |
| Interfaces | PascalCase | `KanbanAutomation` |
| Métodos | PascalCase (exported) / camelCase | `ProcessIncoming` |
| Env vars | UPPER_SNAKE_CASE | `GEMINI_API_KEY` |
| Arquivos TS | PascalCase (componentes) / camelCase | `ChatPanel.tsx`, `useLeads.ts` |

---

## Locais Chave

| O quê | Onde |
|---|---|
| Entrypoint CRM | `backend/cmd/api/main.go` |
| Entrypoint WhatsMiau | `whatsmeow/main.go` |
| DI / wiring CRM | `backend/cmd/api/main.go` |
| Roteamento WhatsMiau | `whatsmeow/server/routes/main.go` |
| AI Sales Agent | `whatsmeow/services/sales_agent.go` |
| Kanban automação | `whatsmeow/services/kanban_automation.go` |
| WhatsApp wrapper | `whatsmeow/lib/whatsmiau/whatsmeow.go` |
| Schema do banco | `whatsmeow/services/migrations.go` |
| Config tipada | `whatsmeow/env/env.go` |
| Ports hexagonais | `backend/internal/core/ports/` |
