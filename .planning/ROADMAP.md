# Roadmap: Sherlock & WhatsMiau Evolution

## Fase 1: Segurança e Hardening (Concluída)
Foco em saneamento de credenciais e validação rigorosa de ambiente.

- [x] **Segurança e Qualidade**
    - Saneamento de JWT e Tokens Internos [CORE-01]
    - Validação de ambiente Fail-Fast [ENV-01]

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

---
## Traceability Matrix

| Req ID  | Phase | Status |
|---------|-------|--------|
| CORE-01 | 1     | ✅      |
| ENV-01  | 1     | ✅      |
| INFRA-01| 2     | ⏳      |
| INFRA-02| 2     | ⏳      |
| SCR-01  | 2     | ⏳      |
| INFRA-05| 2     | ⏳      |
| INFRA-03| 2     | ⏳      |
| INFRA-04| 2     | ⏳      |
| DOS-01  | 3     | ⏳      |
| DOS-02  | 3     | ⏳      |
| AI-02   | 3     | ⏳      |
