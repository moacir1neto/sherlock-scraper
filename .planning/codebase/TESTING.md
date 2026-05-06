---
title: Testing
last_mapped: 2026-05-01
---

# TESTING.md — Estrutura e Práticas de Testes

## Estado Atual

> ⚠️ **Cobertura de testes: ZERO**
>
> Nenhum arquivo de teste foi encontrado no repositório:
> - `*_test.go` — 0 arquivos Go de teste
> - `*.test.tsx / *.test.ts / *.spec.ts` — 0 arquivos de teste frontend

---

## O Que Existe

### Scripts manuais de API (bash)
Localizados em `whatsmeow/`:
- `test-api.sh` — smoke tests manuais via curl
- `test-message.sh` — testes de envio de mensagem
- `test_instance_create.sh` — testa criação de instância WhatsApp

### Scripts de seed / utilitários Go
Localizados em `whatsmeow/scripts/`:
- `create-dev-users.go` — cria usuários para desenvolvimento
- `create-super-admin.go` — cria super admin
- `test-password.go` — valida hash de senha

Estes não são testes automatizados — são scripts de setup executados manualmente.

---

## Frameworks Disponíveis (não utilizados)

### Go
- `testing` (stdlib) — disponível, não utilizado
- Possíveis para adição: `testify`, `gomock`, `httptest`

### TypeScript / React
- Vite suporta `vitest` nativamente — não configurado
- `@testing-library/react` — não instalado

---

## Áreas Críticas sem Cobertura

| Área | Risco |
|---|---|
| `sales_agent.ProcessIncoming()` | Alto — lógica AI + múltiplos branches |
| `kanban_automation.process()` | Alto — transições de status do lead |
| `chat_worker.go` | Alto — processamento de mensagens em produção |
| `repositories/**/sql.go` | Médio — queries SQL raw sem tipagem ORM |
| `migrations.go` | Médio — DDL sem testes de rollback |
| `lib/whatsmiau/whatsmeow.go` | Alto — integração com WhatsApp SDK |
| Frontend CRM Kanban | Médio — DnD e estado complexo |

---

## Recomendações

### Go (curto prazo)
```go
// backend/internal/services/lead_service_test.go
func TestCreateLead_ValidInput_ReturnsCreatedLead(t *testing.T) {
    mockRepo := mocks.NewLeadRepository(t)
    svc := NewLeadService(mockRepo)
    // ...
}
```

### Go (WhatsMiau)
- Usar `httptest.NewRecorder()` para testar controllers Echo
- Mockar `interfaces.LeadRepository` e `interfaces.InstanceRepository`
- Testar `kanban_automation.process()` com states válidos e inválidos

### Frontend
- Configurar `vitest` + `@testing-library/react`
- Testar fluxo de Kanban drag-and-drop
- Testar componentes de Chat com mocks de SSE/WebSocket

---

## CI/CD

- **Não há pipeline de CI/CD configurado** (sem `.github/workflows/`, sem `Makefile` com targets de test)
- Docker Compose é a única forma automatizada de subir o ambiente
