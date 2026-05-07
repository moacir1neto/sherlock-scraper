# Contexto de Fase: Fase 5 — Automações Comerciais e WhatsApp

## 🎯 Escopo Técnico
Implementar a infraestrutura de consumo de eventos e automação SDR no WhatsMiau, integrando-o ao fluxo de notificações do Sherlock.

## 🔑 Decisões de Design
1. **Canal Redis**: `sherlock:notifications` para eventos de saída.
2. **Asynq no WhatsMiau**: Utilizar Asynq para garantir que falhas momentâneas de conexão (WhatsApp offline) não percam notificações comerciais.
3. **Intent Routing**: O agente de vendas (`SalesAgentService`) deve ser desacoplado para permitir que o "Router" classifique a mensagem antes de processar a resposta.
4. **Memória**: Utilizar o `MessageRepository` existente para alimentar o histórico da IA durante o refinamento.

## 🛡️ Guardrails (WAPP-03)
- Máximo de 3 tentativas de reagendamento automático por lead.
- Handoff humano se a IA detectar `intent: FRUSTRATION` ou `intent: UNKNOWN`.
- Não disparar notificações entre 21:00 e 08:00 (opcional para MVP, mas bom considerar).

## 📊 Observabilidade
- `correlation_id` deve ser passado no payload do Redis.
- Logs JSON no padrão: `{"level":"info", "trace_id":"...", "event":"notification_sent", "lead_id":"..."}`.

## Intent Router Contract (STRICT)

### Supported Intents (ENUM FIXO)
- CONFIRMED
- RESCHEDULE
- FOLLOWUP
- QUESTION
- NEGATIVE
- FRUSTRATION
- HUMAN_HANDOFF
- UNKNOWN

---

### Decision Matrix

CONFIRMED
→ mark event as confirmed
→ no reschedule allowed

RESCHEDULE
→ suggest up to 3 slots
→ max 3 attempts per lead

FRUSTRATION / HUMAN_HANDOFF
→ STOP automation immediately
→ notify human operator

NEGATIVE
→ mark opt-out
→ no future messages

UNKNOWN
→ fallback to HUMAN_HANDOFF if confidence < 0.70

---

### Confidence Rules

>= 0.85 → auto execute
0.60 - 0.84 → suggest only
< 0.60 → human handoff

---

### Hard Guardrails
- never override user refusal
- never insist after OPT_OUT
- never auto-reschedule after 3 attempts
- never hallucinate scheduling availability