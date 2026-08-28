# Sherlock Scraper & WhatsMiau

## What This Is

Plataforma SaaS de CRM B2B avançada para prospecção e qualificação automatizada de leads. O sistema integra scraping de alta performance (Sherlock) com comunicação inteligente via WhatsApp (WhatsMiau), utilizando agentes de IA para conduzir leads através do funil de vendas.

## Core Value

Automatizar o ciclo completo de prospecção — da descoberta do lead ao agendamento de reunião — eliminando o trabalho manual de prospecção fria.

## Requirements

### Validated

- ✓ Scraping de leads via Google Places/Maps — existing
- ✓ Gestão de CRM com Pipeline/Kanban dinâmico — existing
- ✓ Conectividade WhatsApp multi-instância (Whatsmeow) — existing
- ✓ Agente de Vendas AI integrado (Gemini/Structured Output) — existing
- ✓ Sistema de Real-time via SSE e WebSockets — existing
- ✓ Enriquecimento de dados via CNPJ — existing
- ✓ Sistema de Notificações de Negócio (Agendamentos/Lembretes) — Phase 4

### Active

- [ ] **Evolução do Super Vendedor AI**: Melhorar precisão do structured output, autonomia de resposta e tratamento de objeções.
- [ ] **Expansão do Sherlock Scraper**: Implementar novas fontes de busca e aumentar resiliência contra bloqueios.
- [ ] **Dossiês Inteligentes**: Automatizar a geração de dossiês profundos sobre leads para municiar o agente de vendas.
- [ ] **Handoff Humano**: Refinar o fluxo de transição entre o agente de IA e o operador humano.

### Out of Scope

- [Aplicativo Mobile Nativo] — O sistema continuará focado em Web App responsivo.
- [Integração com CRMs Externos] — O foco é a excelência do CRM nativo da plataforma.

## Context

O projeto está em uma fase madura de arquitetura (Go/React), mas necessita de evolução nas camadas de inteligência e na robustez das integrações de scraping. A base de código é dividida em dois grandes serviços Go que operam em conjunto via tokens internos.

## Constraints

- **Tech Stack**: Manter Go (Fiber/Echo) no backend e React (Vite) no frontend.
- **Performance**: O scraping não deve comprometer a latência da API principal.
- **Segurança**: Necessidade de rotacionar e proteger tokens internos e secrets JWT.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separação de Backends | Isolar WhatsMiau (WhatsApp) de Sherlock (CRM) para escalabilidade independente. | ✓ Good |
| Uso de Redis/Asynq | Garantir processamento assíncrono de tarefas pesadas (scraping/AI). | ✓ Good |
| Gemini para Sales Agent | Structured output nativo e custo-benefício para automação de chat. | ✓ Good |

## Current State (v1.0.0) ✅
- **Versão Atual**: 1.0.0
- **Destaque**: Sistema de Notificações de Negócio e Scheduler Asynq integrados.
- **Segurança**: Ambiente saneado e JWT validado.

## Next Milestone Goals (v1.1) 🚀
- **WhatsApp Automation**: Concluir o disparo real de notificações via WhatsMiau.
- **Resilience**: Implementar Circuit Breaker e DLQ nas filas do Scraper.
- **Intelligence**: Iniciar os Dossiês Profundos (Deep Research).

## Evolution

---
*Last updated: 2026-05-06 after Phase 4 completion*
