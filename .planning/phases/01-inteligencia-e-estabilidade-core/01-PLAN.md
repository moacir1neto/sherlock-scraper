# Plan: Phase 01-Segurança e Validação de Ambiente

Este plano foca exclusivamente no saneamento de segredos e na validação estrita do ambiente de startup.

## Waves

### Wave 1: Validação de Ambiente e Fail-Fast
**Task 1: Implementar validador centralizado em WhatsMiau**
<read_first>
- `whatsmeow/env/env.go`
- `whatsmeow/main.go`
</read_first>
<action>
1. No arquivo `whatsmeow/env/env.go`, adicionar uma função `Validate()` que verifica se as chaves `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` e `INTERNAL_API_TOKEN` estão preenchidas na struct `Config`.
2. No `whatsmeow/main.go`, chamar `env.Validate()` logo após `env.Load()`. Se retornar erro, usar `log.Fatal` para interromper o startup.
</action>
<acceptance_criteria>
- O serviço WhatsMiau não inicia se `INTERNAL_API_TOKEN` estiver vazio no `.env`.
- Log indica claramente qual variável está faltando.
</acceptance_criteria>

**Task 2: Implementar validador centralizado em Sherlock (Backend)**
<read_first>
- `backend/cmd/api/main.go`
</read_first>
<action>
1. Criar uma lógica de validação de ambiente no início do `main.go` (ou em pacote `internal/config`).
2. Validar obrigatoriedade de `DATABASE_URL`, `REDIS_URL` e `JWT_SECRET`.
3. Abortar com `log.Fatal` em caso de ausência.
</action>
<acceptance_criteria>
- O backend CRM não inicia se `JWT_SECRET` estiver vazio.
</acceptance_criteria>

**Task 3: Remover fallbacks de segredos**
<read_first>
- `backend/internal/middlewares/auth_middleware.go`
</read_first>
<action>
Remover o bloco que atribui um valor padrão à variável `secret` caso `os.Getenv("JWT_SECRET")` seja vazio. A segurança deve depender estritamente da env.
</action>
<acceptance_criteria>
- Nenhuma string de segredo "padrão" existe no middleware de autenticação.
</acceptance_criteria>

## Verification
1. Rodar `docker compose up api` sem o arquivo `.env` e verificar se ele morre com log de erro.
2. Rodar com `.env` completo e verificar startup normal.

---
**Status:** Ready for Execution (Restricted Scope)
