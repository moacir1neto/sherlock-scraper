---
title: Integrations
last_mapped: 2026-05-01
---

# INTEGRATIONS.md — Serviços Externos e Integrações

## APIs de IA

### Google Gemini
- **Usado em:** `whatsmeow/services/sales_agent.go`, `whatsmeow/services/gemini.go`, `backend/internal/services/ai_service.go`
- **Auth:** `GEMINI_API_KEY` via env
- **Função:** Sales agent AI (structured output), geração de dossiês, respostas de CRM
- **SDK Backend CRM:** `github.com/google/generative-ai-go`
- **SDK WhatsMiau:** chamada REST direta ao endpoint Gemini

### Groq
- **Usado em:** `whatsmeow/services/groq_client.go`
- **Auth:** `GROQ_API_KEY` via env
- **Função:** LLM alternativo para o agente de vendas

---

## Google APIs

### Google Places API
- **Usado em:** `backend/internal/handlers/scrape_handler.go`
- **Auth:** `GOOGLE_PLACES_API_KEY` via env
- **Função:** Busca de negócios por nicho + localização (geração de leads)

### Google Cloud Storage (GCS)
- **Usado em:** `whatsmeow/` — upload de mídia (imagens, vídeos do WhatsApp)
- **Config:** `GCS_ENABLED=true`, `GCS_BUCKET`, `GCS_URL`
- **Auth:** Application Default Credentials (ADC) do Google

### Google Cloud Logging (GCL)
- **Usado em:** `whatsmeow/` — logging centralizado em produção
- **Config:** `GCL_ENABLED=true`, `GCL_PROJECT_ID`, `GCL_APP_NAME`

---

## WhatsApp

### go.mau.fi/whatsmeow
- **Versão:** `v0.0.0-20260421083005` (fork bleeding-edge)
- **Usado em:** `whatsmeow/lib/whatsmiau/whatsmeow.go`
- **Função:** Conexão ao WhatsApp Web, envio/recebimento de mensagens, QR code
- **Persistência:** `go.mau.fi/whatsmeow` SQLStore (tabela `whatsmeow_device`)

---

## Banco de Dados

### PostgreSQL 15
- **Backend CRM:** via GORM — `DATABASE_URL` (host=db user=postgres ...)
- **WhatsMiau:** via `database/sql` raw — `DB_URL` (postgres://...)
- **Banco separado:** WhatsMiau usa schema `whatsmiau`, CRM usa `crm`

### SQLite (dev only)
- **WhatsMiau:** fallback local via `DIALECT_DB=sqlite3`, arquivo `data.db`

---

## Cache e Pub-Sub

### Redis
- **Backend CRM:** `go-redis/v9` — fila Asynq, pub-sub SSE
- **WhatsMiau:** `go-redis/v8` — cache de sessão de usuários (`whatsmeow/repositories/users/redis.go`), pub-sub de eventos de lead

---

## Comunicação Interna (Inter-serviços)

### Sherlock CRM → WhatsMiau
- **Protocolo:** HTTP REST
- **URL:** `WHATSMIAU_API_URL=http://whatsmiau-api:8080`
- **Auth:** Header `X-Internal-Token` com token fixo (`INTERNAL_API_TOKEN`)

### WhatsMiau → Sherlock CRM
- **URL:** `SHERLOCK_URL=http://api:3000`
- **Auth:** `INTERNAL_API_TOKEN` no header
- **Função:** Kanban automation, notificações de lead, busca de dossiê

---

## CNPJ / Dados Empresariais

### Playwright Headless
- **Arquivo:** `backend/internal/handlers/cnpj_handler.go`, `cnpj_scraper.py`
- **Função:** Scraping de dados de CNPJ na Receita Federal

### API CNPJ (bridge)
- **Arquivo:** `bridge_api.py` — servidor HTTP Python que serve dados do scraper Go

---

## Real-time (SSE / WebSocket)

### SSE — Backend CRM
- **Handlers:** `backend/internal/handlers/sse_handler.go`, `campaign_sse_handler.go`
- **Hub:** `backend/internal/sse/hub.go` + `redis_broadcaster.go`
- **Canal Redis:** eventos de lead e campanha

### SSE — WhatsMiau
- **Endpoints:** `handoff_sse`, `lead_sse`, `system_logs_sse`
- **Hub:** `whatsmeow/services/handoff_hub.go`, `system_log_hub.go`
- **Função:** Notificações de handoff do Super Vendedor para o painel admin

### WebSocket — WhatsMiau Chat
- **Handler:** `whatsmeow/server/ws/handler.go` + `hub.go`
- **Endpoint:** `GET /v1/ws/chat`
- **Função:** Chat em tempo real entre operadores e leads

---

## Proxy (WhatsApp)
- **Config:** `PROXY_ADDRESSES` (lista de SOCKS5/HTTP/HTTPS)
- **Estratégia:** `PROXY_STRATEGY=RANDOM` (balanceamento aleatório por instância)
- **Opção:** `PROXY_NO_MEDIA=true` — não rotear mídia pelo proxy
