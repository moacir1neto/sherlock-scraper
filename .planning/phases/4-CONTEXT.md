# Contexto de Decisão — Fase 4: Notificações

## Objetivo
Implementar um sistema de notificações de eventos de negócio, iniciando por um MVP de agendamento de reuniões com alertas em tempo real no painel.

## 🏗️ Arquitetura
1. **Dono do Evento**: O serviço `backend` (Sherlock/CRM) é o mestre da verdade para eventos de negócio.
2. **Real-time**: Uso de Redis Pub/Sub para comunicação entre serviços. Novo canal: `sherlock:notifications`.
3. **SSE**: O serviço `whatsmeow` atua como o broadcaster SSE para o frontend.

## 🗄️ Modelagem (Tabela `business_events`)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `lead_id` | UUID | Referência ao lead no CRM |
| `company_id` | UUID | Suporte multi-tenant |
| `type` | String | `MEETING_SCHEDULED`, `FOLLOWUP_DUE`, etc. |
| `status` | String | `PENDING`, `SENT`, `CANCELED`, `FAILED` |
| `scheduled_at` | Timestamp | Data/hora do evento em si |
| `asynq_task_id`| String | ID da task no Redis para cancelamento (Onda 2) |
| `payload` | JSONB | Dados dinâmicos (lead_name, links, etc.) |
| `external_id` | String | Reservado para integração futura |

## 🛠️ Diretrizes de Implementação

1. **Constantes Centralizadas**: Os tipos de eventos (`MEETING_SCHEDULED`, etc.) devem ser definidos em um local central (ex: `pkg/events` ou no domínio) para evitar strings espalhadas.
2. **Versionamento de Payload**: O JSON do evento deve ser versionado para permitir evolução futura sem quebrar consumidores.
   - Ex: `{ "version": 1, "type": "...", "payload": { ... } }`
3. **Burrice do Backend (UI Decoupling)**: O SSE deve enviar apenas o `type + payload`. O frontend é responsável por decidir o texto, ícone e cor do alerta.

## 🚀 Estratégia de Implementação (Refinada)

### Onda 1 (MVP)
- **Infra de Eventos**: Definição do sistema de constantes e structs de payload versionados.
- **Criação de Evento**: API `POST /v1/events` no `backend`.
- **Notificação Painel**: Disparo imediato via Redis Pub/Sub (`sherlock:notifications`).
- **SSE Broadcast**: WhatsMiau repassa o evento puro para os clientes conectados.


### Onda 2 (Escala & WhatsApp)
- **Scheduler**: Uso de `Asynq.ProcessAt` para agendar as notificações.
- **Múltiplos Lembretes**: Disparo de tasks separadas para 24h, 1h e 15min antes do evento.
- **Cancelamento**: Ao cancelar um evento no banco, buscar `asynq_task_id` e remover do Redis via Asynq Inspector.
- **WhatsApp**: Worker executa chamada HTTP para WhatsMiau para envio de mensagem ativa ao Lead/Vendedor.

## 🛡️ Segurança
- O publisher no `backend` e o subscriber no `whatsmeow` devem garantir que apenas eventos da `company_id` correta sejam entregues ao cliente SSE autenticado.
