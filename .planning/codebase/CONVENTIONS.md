---
title: Conventions
last_mapped: 2026-05-01
---

# CONVENTIONS.md — Convenções de Código e Padrões

## Go — Backend CRM (`backend/`)

### Estrutura de Handler (Fiber)

```go
// Padrão: struct com dependências + construtor
type ScrapeHandler struct {
    service ports.LeadService
}

func NewScrapeHandler(service ports.LeadService) *ScrapeHandler {
    return &ScrapeHandler{service: service}
}

// Método de handler: parse → validate → delegate → respond
func (h *ScrapeHandler) Start(c *fiber.Ctx) error {
    var req ScrapeRequest
    if err := c.BodyParser(&req); err != nil {
        return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
    }
    // ...
}
```

### Padrão de Ports (Interfaces)

```go
// ports/lead_ports.go — interface define o contrato
type LeadService interface {
    CreateLead(ctx context.Context, lead *domain.Lead) error
    // ...
}

// services/lead_service.go — implementa o port
type leadService struct {
    repo LeadRepository
}
func NewLeadService(repo LeadRepository) LeadService { ... }
```

### Error Handling CRM
- Retornar `fiber.Map{"error": "mensagem"}` com status HTTP adequado
- Não usar `log.Fatal` exceto no `main.go`
- Usar `log.Printf` / `log.Println` (stdlib) para logging básico

---

## Go — WhatsMiau (`whatsmeow/`)

### Logging
- **`go.uber.org/zap`** como logger principal
- Campos estruturados: `zap.String("key", val)`, `zap.Error(err)`
- Padrão de prefixo: `[NomeDoServico]` no início da mensagem

```go
zap.L().Debug("[SalesAgent] company_id não encontrado",
    zap.String("instance", instanceID),
    zap.Error(err),
)
```

### Padrão de Service (WhatsMiau)

```go
// Struct com dependências injetadas
type SalesAgentService struct {
    db           *sql.DB
    instanceRepo interfaces.InstanceRepository
    whatsapp     *whatsmiau.Whatsmiau
    handoffHub   *HandoffHub
    httpClient   *http.Client
    leadRepo     interfaces.LeadRepository
    messageRepo  interfaces.MessageRepository
    broadcaster  ChatBroadcaster
}

// Construtor explícito
func NewSalesAgentService(db *sql.DB, ...) *SalesAgentService {
    return &SalesAgentService{ ... }
}
```

### Padrão de Repository (SQL Raw)

```go
// Interface em interfaces/
type LeadRepository interface {
    FindByPhone(ctx context.Context, companyID string, variants []string) (*models.Lead, error)
}

// Implementação em repositories/<domain>/sql.go
type sqlLeadRepo struct {
    db *sql.DB
}
func (r *sqlLeadRepo) FindByPhone(ctx context.Context, ...) (*models.Lead, error) {
    row := r.db.QueryRowContext(ctx, `SELECT ... WHERE phone = ANY($1)`, pq.Array(variants))
    // ...
}
```

### Padrão de Configuração

```go
// env/env.go — struct tipada com tags caarlos0/env
type E struct {
    Port     string `env:"PORT" envDefault:"8080"`
    DBDialect string `env:"DIALECT_DB" envDefault:"sqlite3"`
}
var Env E

func Load() error {
    _ = godotenv.Load(".env") // ignora erro (arquivo opcional)
    return env.Parse(&Env)
}
```

### Padrão de Response HTTP (WhatsMiau)

```go
// utils/http_response.go
// Funções utilitárias para respostas padronizadas
```

---

## Frontends (React/TypeScript)

### Estrutura de Componente
- Componentes funcionais com hooks
- Props tipadas com `interface` TypeScript
- Arquivos: `PascalCase.tsx` para componentes, `camelCase.ts` para utilitários

### Estado Global
- Context API (sem Zustand/Redux)
- Exemplo: `NotificationContext` para alertas do painel admin

### Comunicação HTTP
- `axios` para REST
- `EventSource` nativo para SSE

### Estilização
- **Frontend CRM:** TailwindCSS 3.4 com `tailwind-merge` + `clsx`
- **Frontend WhatsMiau:** TailwindCSS 3.3

### Padrão de Drag & Drop (CRM Kanban)
- `@hello-pangea/dnd` como primary
- `@dnd-kit/core` como alternativa disponível

---

## Contratos de API Interna (Inter-serviços)

### Header de autenticação interna
```
X-Internal-Token: <INTERNAL_API_TOKEN>
```

### Formato de Response padrão (Fiber)
```json
{ "error": "mensagem de erro" }
{ "data": { ... } }
```

### Formato de Response padrão (Echo/WhatsMiau)
- Via `utils/http_response.go` (helper centralizado)

---

## Docker / Ambiente

### Variáveis de Ambiente por serviço

| Serviço | Fonte |
|---|---|
| Backend CRM | `backend/.env` + `docker-compose.yml` `environment:` |
| WhatsMiau | `docker-compose.yml` `environment:` |
| Frontend CRM | `VITE_API_URL` via compose |
| Frontend WhatsMiau | `VITE_PROXY_TARGET` via compose |

### Persistência de volumes
- `pgdata` — dados PostgreSQL
- `whatsmiau_data` — dados do WhatsMiau (SQLite dev + arquivos)

---

## Padrões Identificados

| Padrão | Onde |
|---|---|
| Construtor `New*` | Todos os serviços e repositórios |
| Injeção via construtor (sem DI framework) | `main.go` de ambos backends |
| Interface em `ports/` (CRM) ou `interfaces/` (WhatsMiau) | Ambos |
| Migrations inline no código | `whatsmeow/services/migrations.go` |
| `context.Context` propagado | Todos os métodos de repositório e serviço |
| SQL raw para WhatsMiau | `repositories/**/sql.go` |
| GORM para CRM | `repositories/*.go` |
