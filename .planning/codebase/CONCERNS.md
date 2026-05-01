---
title: Concerns
last_mapped: 2026-05-01
---

# CONCERNS.md — Débito Técnico, Riscos e Áreas de Atenção

## 🔴 Crítico

### 1. Zero cobertura de testes
- **Impacto:** Qualquer refatoração pode quebrar silenciosamente a lógica de AI, Kanban ou mensagens WhatsApp
- **Arquivo:** Todo o codebase
- **Ação:** Adicionar testes unitários começando por `sales_agent.go` e `kanban_automation.go`

### 2. Migrations SQL inline sem versionamento
- **Arquivo:** `whatsmeow/services/migrations.go`
- **Problema:** DDL embutido em código Go, sem runner (Flyway/Goose), sem rollback
- **Risco:** Deploy falha silenciosamente se tabela já existir com schema diferente
- **Ação:** Adotar `golang-migrate` ou `goose` com arquivos `.sql` versionados

### 3. JWT Secret hardcoded como fallback
- **Arquivo:** `backend/internal/middlewares/auth_middleware.go`
```go
secret := os.Getenv("JWT_SECRET")
if secret == "" {
    secret = "super_secret_key_change_in_production" // ← RISCO
}
```
- **Risco:** Em produção com `.env` mal configurado, o secret fraco é usado silenciosamente
- **Ação:** Falhar com `log.Fatal` se `JWT_SECRET` estiver vazio

### 4. Token interno exposto no docker-compose
- **Arquivo:** `docker-compose.yml`
```yaml
INTERNAL_API_TOKEN: "9a3c8f650547ee1b91c947c40f7c792bc303d5bb857f3bbb2c0f0af1c8d98e70"
```
- **Risco:** Token fixo em arquivo versionado — qualquer pessoa com acesso ao repo pode impersonar serviços
- **Ação:** Mover para `.env` (não versionado) + rotação periódica

---

## 🟡 Alto

### 5. TODOs e FIXMEs identificados
- **Arquivos com débito documentado:**
  - `whatsmeow/repositories/users/redis.go`
  - `whatsmeow/lib/whatsmiau/event_emitter.go`
  - `whatsmeow/lib/whatsmiau/chat.go`
  - `whatsmeow/lib/whatsmiau/whatsmeow.go`
  - `whatsmeow/env/env.go` (`ProxyStrategy: "todo: implement BALANCED"`)
  - `whatsmeow/server/controllers/message.go`
  - `backend/internal/queue/dossier_service.go`
  - `backend/internal/services/cnpj_service.go`

### 6. Proxy strategy não implementada
- **Arquivo:** `whatsmeow/env/env.go`
```go
ProxyStrategy string `env:"PROXY_STRATEGY" envDefault:"RANDOM"` // todo: implement BALANCED
```
- **Risco:** Proxy BALANCED configurado em produção resulta em comportamento idêntico ao RANDOM

### 7. SQL raw sem proteção contra SQL injection (potencial)
- **Arquivo:** `whatsmeow/repositories/` (sql.go files)
- **Padrão:** Uso de `database/sql` raw com `$1, $2` — correto se consistente
- **Risco:** Verificar se há queries com string interpolation direta

### 8. Duas versões do Redis client
- **CRM:** `github.com/redis/go-redis/v9`
- **WhatsMiau:** `github.com/go-redis/redis/v8`
- **Risco:** APIs diferentes, manutenção duplicada, possível incompatibilidade se Redis features mudarem

### 9. whatsmeow SDK bleeding-edge
- **Versão:** `go.mau.fi/whatsmeow v0.0.0-20260421083005` (commit hash, não release semântico)
- **Risco:** Quebras de API sem aviso, difícil rastrear changelog
- **Ação:** Fixar em tag estável ou monitorar upstream ativamente

### 10. Frontend CRM sem gerenciamento de estado global robusto
- **Problema:** Context API para estado complexo de Kanban + Notificações + Chat pode causar re-renders excessivos
- **Risco:** Performance degradada com muitos leads/mensagens simultâneas

---

## 🟠 Médio

### 11. Sem CI/CD
- Sem `.github/workflows/`, sem `Makefile` com targets padronizados
- Risco de deploy manual sem validação automatizada

### 12. CORS hardcoded
- **Arquivo:** `backend/cmd/api/main.go`
```go
AllowOrigins: "http://localhost:5173, http://localhost:3031, ..."
```
- Em produção, origins de prod não estão configuradas via env

### 13. Scraper Python legado
- `cnpj_scraper.py` e `bridge_api.py` são scripts Python standalone
- Sem integração formal no sistema de fila (Asynq)
- Duplicação com `backend/internal/handlers/cnpj_handler.go`

### 14. Dois schemas PostgreSQL, mesmo servidor
- `crm` (CRM backend) e `whatsmiau` (WhatsMiau) no mesmo host PostgreSQL
- Sem isolamento de connection pooling entre serviços
- Risco de contenção em produção com muitos WhatsApp sessions

### 15. Volumes Docker com dados sensíveis
- `whatsmiau_data` monta `/app/data` — inclui SQLite e sessões WhatsApp
- Sem backup automatizado configurado

---

## 🟢 Baixo (Melhorias)

### 16. Sem documentação de API (OpenAPI/Swagger)
- Rotas Echo e Fiber não têm anotações de documentação automática

### 17. Dependência de Playwright em produção
- `backend/`: Playwright headless em container Go para CNPJ scraping
- Aumenta tamanho da imagem Docker significativamente

### 18. Scripts em `whatsmeow/scripts/` sem automação
- `create-dev-users.go` deve ser executado manualmente — não integrado ao seed workflow

---

## Resumo de Prioridades

| # | Problema | Severidade | Esforço |
|---|---|---|---|
| 3 | JWT secret fallback inseguro | Crítico | Baixo |
| 4 | Internal token no compose | Crítico | Baixo |
| 2 | Migrations sem versionamento | Crítico | Médio |
| 1 | Zero testes | Crítico | Alto |
| 9 | whatsmeow bleeding-edge | Alto | Baixo |
| 12 | CORS hardcoded | Médio | Baixo |
| 11 | Sem CI/CD | Médio | Médio |
