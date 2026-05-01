# Validation Strategy: Phase 01-Inteligência e Estabilidade Core

**Phase:** 01
**Slug:** inteligencia-e-estabilidade-core
**Date:** 2026-05-01

## Success Criteria

### 1. Resiliência AI
- [ ] O sistema tenta novamente (1x) se o Gemini retornar erro 5xx ou JSON inválido.
- [ ] Em caso de falha final, o lead é marcado com `ai_failed=true` no banco.
- [ ] O handoff humano é disparado automaticamente em falhas críticas de IA.

### 2. Handoff Híbrido
- [ ] Mensagens contendo "quero falar com humano" ou "reclamação" pausam a IA imediatamente.
- [ ] O campo `acionar_humano` do Gemini continua funcionando normalmente para outros casos.

### 3. Segurança
- [ ] O backend CRM (api) dá panic se `JWT_SECRET` não estiver no `.env`.
- [ ] O serviço WhatsMiau dá panic se `INTERNAL_API_TOKEN` não estiver no `.env`.
- [ ] Removido fallback "super_secret_key" do middleware de autenticação.

### 4. Testes Kanban
- [ ] Execução de `go test ./services/...` passa com 100% de sucesso para a automação de status.
- [ ] Cobertura básica de caminhos felizes e idempotência (lead já no status final).

## Verification Commands
- `go test -v ./whatsmeow/services/kanban_automation_test.go`
- `docker compose up api whatsmeow` (validar startup com/sem envs)
- Simulação de erro JSON no Gemini via interceptação ou log (QA).
