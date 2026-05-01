# Phase Research: 01-Inteligência e Estabilidade Core

## Overview
Esta pesquisa foca em implementar resiliência no Agente de Vendas (Gemini), saneamento de segurança no startup dos serviços e criação de uma base de testes unitários para a automação do Kanban.

## 1. Resiliência AI (WhatsMiau)
- **Localização**: `whatsmeow/services/sales_agent.go` -> `callGemini`.
- **Estratégia**:
    - Envolver a chamada `httpClient.Do` e o `json.Unmarshal` em um loop de retry (máx 1 tentativa extra).
    - Usar um `time.Sleep` com backoff exponencial simples (ex: 500ms).
    - Se falhar após retry, acionar `pauseChat` e marcar o lead com uma nova flag no banco (necessita migração SQL para adicionar `ai_failed` na tabela `leads`).
- **Migração Sugerida**: `ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_failed BOOLEAN DEFAULT false;`

## 2. Handoff Híbrido e Sentimento
- **Localização**: `whatsmeow/services/sales_agent.go` -> `ProcessIncoming`.
- **Estratégia**:
    - Antes de chamar a IA, verificar se o conteúdo da mensagem contém palavras-chave críticas (blacklist local).
    - Unir essa detecção ao booleano `acionar_humano` retornado pelo Gemini.
    - Se qualquer um disparar, chamar `pauseChat` e `PublishHandoff`.

## 3. Segurança (Panic on Startup)
- **Localização**: `backend/cmd/api/main.go` e `whatsmeow/main.go`.
- **Estratégia**:
    - Criar uma função auxiliar `env.ValidateCritical()` que verifica se `JWT_SECRET`, `INTERNAL_API_TOKEN` e `DATABASE_URL` estão populados.
    - Chamar essa função logo após `env.Load()`.
    - No `backend/internal/middlewares/auth_middleware.go`, remover o fallback de string hardcoded para o `JWT_SECRET`.

## 4. Testes Kanban
- **Localização**: `whatsmeow/services/kanban_automation.go`.
- **Estratégia**:
    - Criar `whatsmeow/services/kanban_automation_test.go`.
    - Implementar mocks manuais para `interfaces.LeadRepository`, `interfaces.InstanceRepository` e `ChatBroadcaster`.
    - Testar os métodos `ProcessIncomingMessage` e `ProcessOutgoingMessage` verificando se os status de destino e a idempotência funcionam conforme esperado.

## Validation Architecture (Nyquist)

### Dimensão 8: Monitoramento e Verificação
- **Automação**: Os testes unitários do Kanban devem ser integrados ao processo de CI ou executados via script de validação.
- **Observabilidade**: Logs estruturados em caso de falha de IA (`ai_failed`) permitirão monitorar a taxa de sucesso das automações.
- **Segurança**: O bloqueio no startup garante que o sistema nunca suba em estado inseguro por falta de configuração.

---
*Research complete.*
