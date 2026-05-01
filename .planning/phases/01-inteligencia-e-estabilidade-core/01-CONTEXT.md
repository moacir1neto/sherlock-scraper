# Phase Context: 01-Inteligência e Estabilidade Core

## Domain
Evolução da inteligência do Agente de Vendas (WhatsMiau) e saneamento da segurança e qualidade do sistema (CRM/WhatsMiau).

## Decisions

### 1. Resiliência de Resposta AI (WhatsMiau)
- **Retry Logic**: Implementar retry automático de 1x com backoff exponencial (ex: 500ms) se a resposta do Gemini falhar ou retornar JSON inválido.
- **Fail-safe**: Se o retry falhar, logar o erro de forma estruturada, marcar o lead com a flag `ai_failed` (no banco) e realizar o handoff humano imediato via SSE sem enviar resposta automática ao lead.
- **Arquivo Alvo**: `whatsmeow/services/sales_agent.go`.

### 2. Gatilhos de Interrupção Híbridos
- **Abordagem**: Combinar decisão da IA (`acionar_humano: true`) com uma lista de palavras-chave críticas local (ex: "reclamação", "processo", "procon", "cancelar", "quero falar com uma pessoa").
- **Ação**: Se qualquer um dos gatilhos disparar, pausar a IA para aquele chat (`ai_paused = true`) e emitir alerta de handoff.
- **Arquivo Alvo**: `whatsmeow/services/sales_agent.go`.

### 3. Enforcement de Segurança (Zero Tolerance)
- **Startup Panic**: Ambos os serviços Go devem falhar no startup (panic/Fatal) se as seguintes variáveis estiverem ausentes no `.env`:
    - `JWT_SECRET`
    - `INTERNAL_API_TOKEN`
    - `DATABASE_URL`
- **Rationale**: Garantir que o ambiente seja explícito e seguro, evitando fallbacks silenciosos para chaves de desenvolvimento.
- **Arquivos Alvo**: `backend/cmd/api/main.go`, `whatsmeow/main.go`, `backend/internal/middlewares/auth_middleware.go`.

### 4. Estratégia de Testes Kanban
- **Mocks**: Utilizar mocks manuais baseados nas interfaces existentes (`interfaces.LeadRepository`, etc). Não introduzir geradores automáticos (gomock) agora para manter a simplicidade.
- **Foco**: Testar o comportamento da lógica de negócio em `kanban_automation.go` (mudança de status em mensagens de entrada/saída).
- **Arquivo Alvo**: `whatsmeow/services/kanban_automation.go`.

## Code Context
- **AI Agent**: `whatsmeow/services/sales_agent.go` (lógica principal de decisão).
- **Auth Middleware**: `backend/internal/middlewares/auth_middleware.go` (ponto de injeção de segredos).
- **Kanban Logic**: `whatsmeow/services/kanban_automation.go` (alvo dos testes).

## Canonical Refs
- `whatsmeow/services/sales_agent.go`
- `whatsmeow/services/kanban_automation.go`
- `backend/internal/middlewares/auth_middleware.go`
- `whatsmeow/main.go`
- `backend/cmd/api/main.go`

## Deferred Ideas
- Suporte a múltiplos modelos de LLM (Claude/GPT-4) — Movido para Fase 4+.
- Interface Visual para edição da lista de palavras-chave de interrupção.

---
*Last updated: 2026-05-01 after discussion*
