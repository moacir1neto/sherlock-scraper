# Phase Context: 01-Segurança e Validação de Ambiente

## Domain
Saneamento de segurança e formalização de um contrato estrito de configuração de ambiente (Environment Configuration Contract) para garantir estabilidade *production-grade* no startup dos serviços.

## Decisions

### 1. Contrato de Ambiente Explícito
As seguintes variáveis de ambiente formam o contrato estrito de configuração.

**WHATSMAIU SERVICE (whatsmeow):**
- `DATABASE_URL` (obrigatório)
- `REDIS_URL` (obrigatório)
- `INTERNAL_API_TOKEN` (obrigatório)
- `JWT_SECRET` (obrigatório)

**SHERLOCK BACKEND:**
- `DATABASE_URL` (obrigatório)
- `REDIS_URL` (obrigatório)
- `JWT_SECRET` (obrigatório)

**SERVIÇOS EXTERNOS (opcionais no startup):**
- `GEMINI_API_KEY`
- `GOOGLE_PLACES_API_KEY`

### 2. Camada Centralizada de Validação
- **Padronização**: Ambos os serviços (`whatsmeow` e `backend`) devem usar um pacote dedicado (`env` ou `config`).
- **Struct Loader**: A configuração deve ser carregada em uma `struct` e o acesso às variáveis deve ocorrer *exclusivamente* através dessa struct. Acesso direto via `os.Getenv` espalhado pelo código é proibido.
- **Validação**: A struct deve possuir um método `Validate()` que retorna erros descritivos caso chaves obrigatórias estejam ausentes.

### 3. Comportamento Fail-Fast e Saneamento
- **Zero Fallbacks**: Valores default *hardcoded* (como "super_secret_key") devem ser eliminados do código.
- **Fail-Fast**: Se `Validate()` retornar erro (variável obrigatória ausente), a aplicação deve abortar imediatamente o startup (`log.Fatal` ou `panic`). O sistema não deve tentar rodar em estado de configuração incompleto.

## Code Context
- **CRM Backend**: `backend/cmd/api/main.go`, `backend/internal/middlewares/auth_middleware.go` (a criar `backend/internal/config/env.go`).
- **WhatsMiau Service**: `whatsmeow/main.go`, `whatsmeow/env/env.go`.

## Canonical Refs
- `backend/cmd/api/main.go`
- `whatsmeow/main.go`
- `backend/internal/middlewares/auth_middleware.go`
- `whatsmeow/env/env.go`

## Deferred Ideas (Movidos para próximas fases)
- Migrações versionadas.
- Resiliência e retries de IA/Filas.
- Observabilidade e logs JSON.
- Automação de testes.

---
*Last updated: 2026-05-01 after formal environment contract refinement*
