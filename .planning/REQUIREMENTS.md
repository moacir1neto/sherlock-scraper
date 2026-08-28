# Requirements: Milestone v1.1 (Inteligência Comercial e Automações)

## 🎯 Objetivo da Meta
Transformar o Sherlock em um CRM operacional maduro, atuando como um SDR autônomo e motor de automação comercial com alta confiabilidade operacional e contexto orientado a eventos.

## Requisitos Escopados

### 🤖 Automação WhatsApp & AI SDR (Fase 5)
- [ ] **WAPP-01**: Implementar sistema de templates híbridos para notificações (Estrutura base fixa + Variáveis dinâmicas + Refinamento de tom/contexto via IA).
- [ ] **WAPP-02**: Habilitar reagendamento automático pelo "Super Vendedor AI" para cenários simples (conflitos de agenda, remarcação de horário).
- [ ] **WAPP-03**: Implementar "Safety Guardrails" para o AI SDR: limites de tentativas de reagendamento e regras de handoff imediato para humano em caso de fricção ou ambiguidade.
- [ ] **WAPP-04**: Integrar memória conversacional para garantir que a IA mantenha o contexto histórico do lead durante interações assíncronas.

### 🧠 Inteligência e Dossiês (Fase 6)
- [ ] **DOS-01**: Acionar a geração do Dossiê de Inteligência automaticamente após a conclusão do ciclo de enriquecimento do lead.
- [ ] **DOS-02**: Integrar pesquisa web (Google Search) no fluxo do dossiê via Gemini para extrair: notícias recentes, presença digital, stack tecnológico e sinais comerciais.
- [ ] **DOS-03**: Implementar sistema de cache robusto para os dados de enriquecimento e pesquisa web visando controle de custos das APIs (LLM/Search).
- [ ] **DOS-04**: Otimizar o prompt de sistema do agente de vendas para injetar os dados do Dossiê como contexto estratégico ativo.

### 🛡️ Confiabilidade Operacional e Resiliência (Fase 7)
- [ ] **INFRA-01**: Configurar Retry Policies robustas e Dead Letter Queues (DLQ) no Asynq para proteção contra falhas de rede/APIs de terceiros.
- [ ] **INFRA-02**: Implementar Tracing de eventos de negócio ponta a ponta (SSE -> Redis -> WhatsApp) com Correlation IDs (`trace_id`).
- [ ] **INFRA-03**: Garantir a deduplicação de tarefas assíncronas (ex: múltiplos clicks de geração de dossiê não devem criar múltiplas tarefas simultâneas).
- [ ] **INFRA-04**: Consolidar logs estruturados em JSON focados em auditoria e troubleshooting de fluxos críticos.

## 🚫 Out of Scope (Para esta meta)
- Dashboard visual complexo para gestão de filas (adiado para v1.2+).
- Automação via fluxos no-code (tipo Zapier).
- Integração de agentes de voz.
