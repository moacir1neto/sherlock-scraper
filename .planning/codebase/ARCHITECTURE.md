---
title: Architecture
last_mapped: 2026-05-01
---

# ARCHITECTURE.md — Arquitetura e Padrões do Sistema

## Visão Geral

O projeto é uma plataforma de **CRM + WhatsApp + AI Sales Agent**, composta por dois backends Go independentes que se comunicam via HTTP interno.

```
                         ┌─────────────────────────────────────┐
                         │           Docker Compose              │
                         │                                       │
  Browser CRM ──────────►│ frontend:5173  (React/Vite)          │
  Browser WhatsMiau ─────►│ whatsmiau-ui:3031 (React/Vite)      │
                         │         │               │             │
                         │         ▼               ▼             │
                         │  api:3000 (Fiber)  whatsmiau:8080     │
                         │   [Sherlock CRM]  [WhatsMiau API]    │
                         │         │    ◄──────────►  │          │
                         │         │   X-Internal-Token          │
                         │         ▼               ▼             │
                         │       PostgreSQL db:5432               │
                         │          (crm | whatsmiau schemas)    │
                         │         ▼               ▼             │
                         │       Redis:6379 (fila + pub-sub)     │
                         │                               │       │
                         │              WhatsApp Web ◄──┘        │
                         └─────────────────────────────────────┘
```

---

## Serviço 1: Sherlock CRM (`backend/`)

### Padrão arquitetural: Ports & Adapters (Hexagonal)

```
cmd/api/main.go
  └── internal/
        ├── core/
        │     ├── domain/      ← entidades (Lead, Pipeline, User, Dossier...)
        │     └── ports/       ← interfaces (LeadPort, KanbanPort, WhatsAppPort...)
        ├── handlers/          ← adaptadores HTTP (Fiber controllers)
        ├── services/          ← casos de uso (implementam ports)
        ├── repositories/      ← adaptadores de banco (GORM)
        ├── queue/             ← workers Asynq (scraping, dossier)
        ├── sse/               ← Server-Sent Events hub
        └── middlewares/       ← JWT auth, internal token
```

**Fluxo de dados:**
```
HTTP Request → Handler → Service (port impl) → Repository (GORM) → PostgreSQL
                                ↓
                        Queue (Asynq/Redis) → Worker → Playwright / Gemini AI
                                ↓
                        SSE Hub → Browser (real-time updates)
```

**Injeção de dependências:** Manual, via construtores em `main.go`. Sem framework DI.

---

## Serviço 2: WhatsMiau (`whatsmeow/`)

### Padrão arquitetural: Layered + Repository

```
main.go
  └── server/
        ├── routes/        ← registro de rotas Echo (Load, V1, Auth...)
        ├── controllers/   ← handlers HTTP (thin — delegam aos services)
        ├── middleware/    ← auth JWT, admin, super_admin
        ├── dto/           ← structs de request/response
        └── ws/            ← WebSocket hub de chat
  ├── services/            ← lógica de negócio
  │     ├── sales_agent.go         ← AI Super Vendedor
  │     ├── kanban_automation.go   ← automação de status Kanban
  │     ├── chat_worker.go         ← processamento de mensagens WhatsApp
  │     ├── scheduled_worker.go    ← mensagens agendadas
  │     ├── handoff_hub.go         ← SSE hub para alertas de handoff
  │     ├── migrations.go          ← DDL inline (sem migration runner)
  │     └── gemini.go / groq_client.go ← clientes AI
  ├── repositories/        ← SQL raw com database/sql
  │     ├── instances/
  │     ├── chats/
  │     ├── messages/
  │     ├── leads/
  │     └── users/ (sql.go + redis.go)
  ├── interfaces/          ← contratos/ports Go
  ├── lib/whatsmiau/       ← wrapper sobre go.mau.fi/whatsmeow
  ├── models/              ← structs de domínio
  ├── env/                 ← configuração via env vars
  └── utils/               ← JWT, hash, respostas HTTP
```

**Fluxo WhatsApp → AI:**
```
Mensagem WhatsApp →  whatsmeow event → chat_worker.ProcessMessage()
                                              ↓
                              sales_agent.ProcessIncoming()
                                ├── Verifica ai_enabled + ai_paused
                                ├── Carrega histórico + dossiê
                                ├── Chama Gemini (structured output)
                                └── AgentResponse
                                      ├── acionar_humano=true → SSE handoff → pausa IA
                                      ├── agendou_reuniao=true → Kanban "reuniao_agendada"
                                      └── default → envia resposta WhatsApp
```

---

## Frontends

### Frontend CRM (`frontend/`)
- **Roteamento:** React Router DOM 6
- **Estado:** Context API (sem Redux/Zustand)
- **Drag & Drop:** `@hello-pangea/dnd` para Kanban
- **Comunicação:** Axios + SSE (`EventSource`)

### Frontend WhatsMiau (`whatsmeow/frontend/`)
- **Roteamento:** React Router DOM 6
- **Gráficos:** Chart.js 4 via `react-chartjs-2`
- **QR Code:** `qrcode.react` para conexão de instâncias WhatsApp
- **WebSocket:** cliente nativo para chat em tempo real

---

## Padrão de Autenticação

### CRM (Fiber)
- JWT via header `Authorization: Bearer <token>`
- Middleware: `middlewares.Protected()` usando `gofiber/contrib/jwt`
- Token interno: header `X-Internal-Token` para comunicação inter-serviços

### WhatsMiau (Echo)
- JWT via header `Authorization: Bearer <token>` OU `?token=<token>` (query param para SSE)
- Middleware global: `middleware.AuthOrJWT` aplicado via `app.Pre()`
- Roles: `user`, `admin`, `super_admin`

---

## Padrão de Real-time

| Mecanismo | Serviço | Uso |
|---|---|---|
| SSE (EventSource) | CRM | Atualizações de lead, campanha |
| SSE | WhatsMiau | Alertas de handoff, logs do sistema, eventos de lead |
| WebSocket | WhatsMiau | Chat operador↔lead em tempo real |
| Redis Pub-Sub | CRM | Broadcast SSE multi-instância |

---

## Migrations

- **CRM:** GORM AutoMigrate (implícito na inicialização)
- **WhatsMiau:** DDL SQL inline em `services/migrations.go` — `RunMigrations()` chamado no `main.go`
- **Sem migration runner** (Flyway/Goose): potencial débito técnico
