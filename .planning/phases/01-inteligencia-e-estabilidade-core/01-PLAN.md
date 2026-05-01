# Plan: Phase 01-Inteligência e Estabilidade Core (Production-Grade)

Este plano estabelece a base de confiabilidade e segurança necessária para a expansão do Sherlock Scraper e WhatsMiau.

## Waves

### Wave 1: Segurança e Ambiente (Fail-Fast)
**Task 1: Centralização e Validação de Envs**
<read_first>
- `backend/cmd/api/main.go`
- `whatsmeow/main.go`
- `whatsmeow/env/env.go`
</read_first>
<action>
1. Criar um pacote `config` unificado para cada serviço.
2. Implementar validação estrita: o serviço deve disparar `zap.L().Fatal` se `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` ou `INTERNAL_API_TOKEN` estiverem ausentes.
3. Remover todos os fallbacks de strings hardcoded nos middlewares e handlers.
</action>
<acceptance_criteria>
- Startup falha imediatamente se o arquivo `.env` estiver vazio ou faltar chaves críticas.
- Logs de erro de startup são claros e indicam o campo faltante.
</acceptance_criteria>

### Wave 2: Persistência Versionada (Migrations)
**Task 2: Integrar golang-migrate**
<read_first>
- `whatsmeow/services/migrations.go`
- `docker-compose.yml`
</read_first>
<action>
1. Instalar `github.com/golang-migrate/migrate/v4`.
2. Criar diretórios de migração e mover o DDL existente para arquivos `.up.sql`.
3. Adicionar lógica de execução automática das migrações no `main.go` antes da inicialização dos serviços.
</action>
<acceptance_criteria>
- O esquema do banco é criado/atualizado via arquivos de migração versionados.
- Tabela `schema_migrations` existe no banco de dados.
</acceptance_criteria>

### Wave 3: Confiabilidade de Filas (Asynq)
**Task 3: Retry e Idempotência no Asynq**
<read_first>
- `backend/internal/queue/server.go`
- `backend/internal/queue/tasks.go`
</read_first>
<action>
1. Configurar `asynq.Config{ RetryDelayFunc: ... }` para backoff exponencial.
2. Adicionar `asynq.TaskID` único no `Enqueue` de tarefas de enriquecimento e scraping para evitar processamento duplicado do mesmo lead em curto espaço de tempo.
3. Implementar `ErrorHandler` global para logar falhas permanentes com stack trace.
</action>
<acceptance_criteria>
- Tarefas falhas são reprocessadas com atraso crescente.
- Tentativas de duplicar a mesma tarefa (mesmo ID) são ignoradas pelo Asynq.
</acceptance_criteria>

### Wave 4: Observabilidade (Structured Logs)
**Task 4: Padronização JSON Logging e Tracing**
<read_first>
- `whatsmeow/lib/log-connect/`
- `backend/cmd/api/main.go` (config do zap)
</read_first>
<action>
1. Configurar o `zap` para usar `NewProductionEncoderConfig` (JSON) em ambientes que não sejam `development`.
2. Garantir que logs de tarefas assíncronas incluam o `task_id` e `lead_id` como campos de primeira classe.
</action>
<acceptance_criteria>
- Logs saem em formato JSON estruturado.
- É possível filtrar logs de uma tarefa específica pelo `task_id`.
</acceptance_criteria>

### Wave 5: Inteligência e Resiliência AI
**Task 5: Retry Gemini e Handoff Híbrido**
<read_first>
- `whatsmeow/services/sales_agent.go`
</read_first>
<action>
1. Adicionar loop de retry em `callGemini`.
2. Implementar interceptador de palavras-chave críticas ("PROCON", "cancelar", "quero falar com humano") para interrupção instantânea (bypass da IA).
3. Marcar leads com falha de IA (`ai_failed`) para auditoria manual.
</action>
<acceptance_criteria>
- Blacklist de palavras-chave dispara handoff imediato.
- Falhas do Gemini não derrubam o worker, mas marcam o lead para revisão.
</acceptance_criteria>

### Wave 6: Cobertura de Testes Expandida
**Task 6: Testes de Integração e Cenários de Falha**
<read_first>
- `whatsmeow/services/kanban_automation.go`
</read_first>
<action>
1. Criar testes para `env.Validate()`.
2. Criar testes para o fallback Gemini -> Groq.
3. Testar a lógica de idempotência do Asynq simulando tarefas duplicadas.
</action>
<acceptance_criteria>
- `go test ./...` cobre os novos fluxos de estabilidade.
</acceptance_criteria>

## Verification
- Executar migrations e verificar integridade.
- Simular ausência de ENV e verificar panic.
- Simular erro do Gemini e verificar retry/fallback.
- Enviar mensagem de blacklist e verificar interrupção imediata.

---
**Status:** Ready for Execution (YOLO Mode)
