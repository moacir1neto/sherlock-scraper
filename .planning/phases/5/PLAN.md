# Plano de Fase: Fase 5 — Automações Comerciais e WhatsApp

## 🎯 Objetivo
Transformar o Sherlock em um CRM operacional maduro com um SDR autônomo (WhatsMiau), capaz de realizar disparos inteligentes via WhatsApp, processar intenções do lead para reagendamento e manter a confiabilidade operacional via arquitetura orientada a eventos.

---

## 🏗️ Design Arquitetural

### 1. Fluxo de Entrega (Event-Driven Pipeline)
1. **Sherlock (Backend)**: Publica evento no canal Redis `sherlock:notifications`.
2. **WhatsMiau (Consumer)**: Escuta o canal e enfileira uma tarefa no **Asynq**.
3. **WhatsMiau (Worker)**: Processa a tarefa:
   - Recupera contexto (Lead + Histórico + Timeline).
   - **Refinement Agent**: Processa o template híbrido via IA.
   - **Delivery**: Envia via Whatsmeow.
   - **Tracking**: Atualiza status (sent, delivered, failed).

### 2. AI Intent Router (WhatsMiau)
- Refatoração do `SalesAgentService` para incluir um roteador de intenções:
  - `RESCHEDULE_REQUEST`: IA tenta reagendar via regras de negócio.
  - `NEGOTIATION`: IA continua a conversa.
  - `FRUSTRATION/HUMAN`: Handoff imediato.
  - `UNKNWON`: Notifica operador.

---

## 🌊 Ondas de Implementação

### Onda 1: Base de Eventos e Infra de Entrega (WhatsMiau)
- [ ] **DB Migration**: Criar tabela `notifications` em WhatsMiau para tracking.
- [ ] **Redis Subscriber**: Implementar `NotificationSubscriber` em `WhatsMiau/services`.
- [ ] **Asynq Integration**: Configurar workers de entrega em `WhatsMiau`.
- [ ] **Delivery Tracking**: Rota/Endpoint para atualizar status de entrega (webhooks simulados/logs).

### Onda 2: Templates Híbridos e Refinement Agent
- [ ] **Prompt Engineering**: Criar o `NotificationRefinementAgent` (focado em tom e contexto).
- [ ] **Template Engine**: Lógica de substituição de variáveis dinâmicas (nome, data, nicho).
- [ ] **Injeção de Contexto**: Puxar `BusinessEvents` (timeline) e `LeadAnalysis` para o prompt do agente.

### Onda 3: Intent Router e Reagendamento Automático
- [ ] **Intent Classification**: Implementar classificação de intenções no structured output do Gemini.
- [ ] **Rescheduling Logic**: Agente sugere novos horários se lead pedir "posso amanhã?".
- [ ] **Guardrails**: Contador de tentativas de reagendamento e limite de autonomia antes do handoff.

### Onda 4: Confiabilidade e Observabilidade
- [ ] **Retry Policy**: Configurar retentativas exponenciais no Asynq para falhas de rede.
- [ ] **Correlation IDs**: Propagar `trace_id` do Sherlock até o WhatsMiau para debug ponta a ponta.
- [ ] **Inference Tracking**: Logar consumo de tokens/custo por notificação.

---

## 🧪 Critérios de Aceite (UAT)
1. **Disparo Real**: Notificação criada no Sherlock chega no WhatsMiau e é enviada.
2. **Refinamento**: A mensagem enviada não é um texto fixo, mas sim uma versão "humanizada" pela IA.
3. **Reagendamento**: Lead responde "não posso às 10h, pode às 15h?" e a IA responde confirmando e marcando como agendada.
4. **Resiliência**: Ao derrubar o WhatsMiau, as notificações pendentes são processadas após o retorno.

---

## 🛠️ Ferramentas e Deps
- **WhatsMiau**: Go, Whatsmeow, Asynq, Redis.
- **IA**: Gemini 2.5 Flash (Structured Output).
- **Backend**: Go (Sherlock API).
