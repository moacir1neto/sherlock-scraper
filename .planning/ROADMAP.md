# Roadmap: Sherlock & WhatsMiau Evolution

## Fase 1: Inteligência e Estabilidade Core
Foco em tornar o agente de vendas mais robusto e sanear vulnerabilidades críticas de segurança identificadas no mapeamento.

- [ ] **AI & Handoff**
    - Refinar Structured Output do Gemini [AI-01]
    - Sistema de interrupção de IA por sentimento [AI-03]
- [ ] **Segurança e Qualidade**
    - Saneamento de JWT e Tokens Internos [CORE-01]
    - Testes unitários para Automação Kanban [CORE-02]

## Fase 2: Resiliência do Scraper e Enriquecimento
Foco em aumentar a taxa de sucesso da coleta de dados e iniciar o fluxo de dossiês.

- [ ] **Sherlock Evolution**
    - Rotação de Headers e User-Agents [SCR-01]
    - Webhooks de conclusão de tarefa [SCR-04]
- [ ] **Dossier Foundation**
    - Armazenamento estruturado de Dossiês (Markdown) [DOS-03]
    - Gatilho automático de geração pós-importação [DOS-01]

## Fase 3: Dossiês Profundos e Autonomia
Foco em dar "profundidade" ao conhecimento do agente sobre o lead.

- [ ] **Advanced Dossiers**
    - Integração com Google Search para pesquisa web [DOS-02]
    - Injeção contextual de dossiê no prompt da IA [AI-04]
- [ ] **UX & Memória**
    - Memória de curto prazo para chats [AI-02]
    - Busca multi-localização no scraper [SCR-02]

---
## Traceability Matrix

| Req ID | Phase | Plan | Status |
|--------|-------|------|--------|
| AI-01  | 1     | -    | ⏳      |
| AI-03  | 1     | -    | ⏳      |
| CORE-01| 1     | -    | ⏳      |
| CORE-02| 1     | -    | ⏳      |
| SCR-01 | 2     | -    | ⏳      |
| SCR-04 | 2     | -    | ⏳      |
| DOS-01 | 2     | -    | ⏳      |
| DOS-03 | 2     | -    | ⏳      |
| DOS-02 | 3     | -    | ⏳      |
| AI-04  | 3     | -    | ⏳      |
| AI-02  | 3     | -    | ⏳      |
| SCR-02 | 3     | -    | ⏳      |
