# Phase Context: 01-Inteligência e Estabilidade Core

## Domain
Evolução da inteligência do Agente de Vendas (WhatsMiau) e estabelecimento de infraestrutura de estabilidade de nível de produção (Core Reliability).

## Decisions

### 1. Mensageria e Filas (Asynq)
- **Retry Strategy**: Configurar retries exponenciais para tarefas de Scraping e chamadas de IA.
- **Idempotência**: Implementar verificação de idempotência em tasks críticas usando IDs únicos de lead/processo como `TaskID` do Asynq.
- **Failure Handling**: Criar handlers de `ErrorHandler` no Asynq para logar falhas permanentes com contexto completo no banco e via Zap.

### 2. Gestão de Ambiente (Environment)
- **Centralização**: Criar um carregador de ambiente centralizado em `backend/internal/config` (CRM) e `whatsmeow/env` (WhatsMiau).
- **Fail-Fast**: O startup de ambos os serviços deve abortar (`Panic/Fatal`) se variáveis críticas estiverem ausentes (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `INTERNAL_API_TOKEN`).

### 3. Observabilidade e Logs
- **Structured Logging**: Migrar todos os logs para formato JSON estruturado usando `uber-go/zap`.
- **Tracing**: Incluir `trace_id` em logs que atravessam chamadas de IA e processamento de filas para facilitar o debug fim-a-fim.

### 4. Testes e Cobertura
- **Escopo**: Expandir testes unitários para cobrir cenários de fallback de IA (Gemini -> Groq), validação de ambiente e lógica de processamento do Asynq.
- **Mocks**: Continuar com mocks manuais baseados em interfaces para manter a simplicidade e portabilidade.

### 5. Migrações de Banco de Dados
- **Tooling**: Introduzir **`golang-migrate`** (recomendado pela versatilidade) para gerenciar migrações de esquema versionadas.
- **Transição**: Mover migrações existentes (ex: `whatsmeow/services/migrations.go`) para arquivos `.sql` versionados em `/migrations`.

### 6. Agente de IA e Handoff
- **Resiliência**: Retry automático (1x) em chamadas de IA falhas.
- **Handoff Híbrido**: Interrupção imediata por palavras-chave críticas ("PROCON", "cancelar", etc) combinada com a decisão da IA.

## Code Context
- **Asynq Setup**: `backend/internal/queue/` e workers.
- **AI Agent**: `whatsmeow/services/sales_agent.go`.
- **Auth Middleware**: `backend/internal/middlewares/auth_middleware.go`.
- **Database**: `whatsmeow/services/migrations.go`.

## Canonical Refs
- `whatsmeow/services/sales_agent.go`
- `backend/internal/middlewares/auth_middleware.go`
- `whatsmeow/main.go`
- `backend/cmd/api/main.go`
- `docker-compose.yml` (para referências de env)

## Deferred Ideas
- Dashboard de monitoramento visual do Asynq (Asynqmon integrado ao admin).
- Rotação dinâmica de chaves API sem restart.

---
*Last updated: 2026-05-01 after infra refinement*
