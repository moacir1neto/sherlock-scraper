# Roadmap: Sherlock & WhatsMiau Evolution

## Milestone v1.0.0 (Concluída) ✅
- **[v1.0.0-ROADMAP.md](milestones/v1.0.0-ROADMAP.md)**: Segurança, Hardening e Sistema de Notificações de Negócio.

---

## Fase 2: Infraestrutura e Resiliência
Foco em estabilidade operacional, observabilidade e robustez do scraper.

- [ ] **Queue & Reliability**
    - Estratégia de Retry Asynq + DLQ [INFRA-01]
    - Tarefas Idempotentes e Circuit Breaker [INFRA-02]
- [ ] **Scraper Hardening**
    - Rotação de Headers e Rate Limiting [SCR-01]
    - Controle de Timeout (HTTP/AI/Queue) [INFRA-05]
- [ ] **Observability**
    - Logging Estruturado (Zap) + Context [INFRA-03]
    - Observabilidade de Filas [INFRA-04]

## Fase 3: Inteligência e Dossiês
Foco em enriquecimento de leads e capacidades cognitivas da IA.

- [ ] **Dossier Intelligence**
    - Geração de Dossiês via IA [DOS-01]
    - Pipelines de Enriquecimento de Leads [DOS-02]
- [ ] **AI & Memory**
    - Melhorias em Memória e Agentes [AI-02]

- [ ] **AI & Memory**
    - Melhorias em Memória e Agentes [AI-02]

---
## Traceability Matrix

| Req ID   | Phase | Status |
|----------|-------|--------|
| CORE-01  | 1     | ✅      |
| ENV-01   | 1     | ✅      |
| INFRA-01 | 2     | ⏳      |
| INFRA-02 | 2     | ⏳      |
| SCR-01   | 2     | ⏳      |
| INFRA-05 | 2     | ⏳      |
| INFRA-03 | 2     | ⏳      |
| INFRA-04 | 2     | ⏳      |
| DOS-01   | 3     | ⏳      |
| DOS-02   | 3     | ⏳      |
| AI-02    | 3     | ⏳      |
| NOTIF-01 | 4     | ✅      |
| NOTIF-02 | 4     | ✅      |
| NOTIF-03 | 4     | ⏩      |
| NOTIF-04 | 4     | ⏩      |
| NOTIF-05 | 4     | ✅      |
| NOTIF-06 | 4     | ✅      |

