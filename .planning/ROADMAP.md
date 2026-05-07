# Roadmap: Sherlock & WhatsMiau Evolution

## Milestone v1.0.0 (Concluída) ✅
- **[v1.0.0-ROADMAP.md](milestones/v1.0.0-ROADMAP.md)**: Segurança, Hardening e Sistema de Notificações de Negócio.

---

## Milestone v1.1: Inteligência Comercial e Automações 🚀

## Fase 5: Automações Comerciais e WhatsApp
Transformando alertas internos em engajamento real. O CRM age como SDR.
- [ ] Implementar Templates Híbridos (Fixos + IA) [WAPP-01]
- [ ] Habilitar Reagendamento Automático (Cenários Simples) [WAPP-02]
- [ ] Safety Guardrails & Handoff Humano [WAPP-03]
- [ ] Memória Conversacional [WAPP-04]

**Plans:** 4 plans
- [ ] 05-01-PLAN.md — Foundations: pkg/llm constant, event/task/intent constants, ConversationTurn + WhatsAppDelivery domain entities, AutoMigrate
- [ ] 05-02-PLAN.md — GORM repositories + WhatsApp send Asynq task with whatsapp queue, RetryDelayFunc, EventService integration
- [ ] 05-03-PLAN.md — Hybrid template service, intent classifier, reply task with five-branch routing, InternalAuth-gated webhook
- [ ] 05-04-PLAN.md — Conversation memory (Redis + PostgreSQL two-tier), guardrails (antispam, max reschedule, forced handoff)

## Fase 6: Inteligência e Dossiês Profundos
Municiando o Super Vendedor com contexto de alto valor.
- [ ] Automação de Trigger do Dossiê [DOS-01]
- [ ] Pesquisa Web Integrada (Sinais, Techs, Notícias) [DOS-02]
- [ ] Estratégia de Cache e Custo [DOS-03]
- [ ] Injeção de Contexto no Prompt de Vendas [DOS-04]

## Fase 7: Confiabilidade Operacional e Resiliência
Garantindo a entrega de eventos assíncronos sem falhas ocultas.
- [ ] Configuração de Retry Policies e DLQ [INFRA-01]
- [ ] Tracing e Correlation IDs [INFRA-02]
- [ ] Deduplicação de Tasks [INFRA-03]
- [ ] Logs Estruturados Auditáveis [INFRA-04]

---
## Traceability Matrix
| Req ID   | Phase | Status |
|----------|-------|--------|
| WAPP-01  | 5     | ⏳      |
| WAPP-02  | 5     | ⏳      |
| WAPP-03  | 5     | ⏳      |
| WAPP-04  | 5     | ⏳      |
| DOS-01   | 6     | ⏳      |
| DOS-02   | 6     | ⏳      |
| DOS-03   | 6     | ⏳      |
| DOS-04   | 6     | ⏳      |
| INFRA-01 | 7     | ⏳      |
| INFRA-02 | 7     | ⏳      |
| INFRA-03 | 7     | ⏳      |
| INFRA-04 | 7     | ⏳      |
