# Phase Context: 01-Segurança e Validação de Ambiente

## Domain
Saneamento de segurança e robustez do ciclo de inicialização (startup) dos serviços.

## Decisions

### 1. Gestão de Ambiente (Environment)
- **Centralização**: Criar um pacote centralizado `env` ou `config` em ambos os serviços.
- **Fail-Fast**: O startup deve abortar imediatamente (`log.Fatal`) se variáveis críticas estiverem ausentes.
- **Variáveis Críticas**:
    - `DATABASE_URL`
    - `REDIS_URL`
    - `JWT_SECRET`
    - `INTERNAL_API_TOKEN`

### 2. Saneamento de Segredos
- **Hardcoded Secrets**: Remoção total de fallbacks de strings (ex: "super_secret_key") no código-fonte.
- **Requirement**: O sistema só deve rodar se o segredo for provido externamente via env.

## Code Context
- **CRM Backend**: `backend/cmd/api/main.go` e `backend/internal/middlewares/auth_middleware.go`.
- **WhatsMiau Service**: `whatsmeow/main.go` e `whatsmeow/env/env.go`.

## Canonical Refs
- `backend/cmd/api/main.go`
- `whatsmeow/main.go`
- `backend/internal/middlewares/auth_middleware.go`
- `whatsmeow/env/env.go`

## Deferred Ideas (Movidos para próximas fases)
- Migrações versionadas.
- Resiliência e retries de IA/Filas.
- Observabilidade e logs JSON.

---
*Last updated: 2026-05-01 after scope de-escalation*
