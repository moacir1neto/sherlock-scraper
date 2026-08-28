# Plano de Implementação — Fase 4: Notificações (MVP)

Este plano foca na **Onda 1** (MVP), estabelecendo a infraestrutura de eventos e o broadcast em tempo real via SSE.

## 📋 Objetivos
- Criar a infraestrutura de eventos (`business_events`).
- Implementar o disparo de notificações `MEETING_SCHEDULED`.
- Garantir a entrega em tempo real no painel via SSE.

## 🛠️ Onda 1: Infraestrutura e Modelo

### 1.1 Domínio e Constantes
- [ ] Criar `backend/pkg/events/types.go`:
    - Definir constantes `TypeMeetingScheduled`, etc.
    - Estruturas de payload versionadas (ex: `NotificationEventV1`).
- [ ] Criar `backend/internal/core/domain/business_event.go`:
    - Struct `BusinessEvent` refletindo a modelagem decidida no CONTEXT.

### 1.2 Banco de Dados
- [ ] Criar migração SQL para a tabela `business_events`.
    - Campos: `id`, `lead_id`, `company_id`, `type`, `status`, `scheduled_at`, `asynq_task_id`, `payload` (JSONB).

### 1.3 Publisher (Backend)
- [ ] Atualizar `backend/internal/sse/redis_broadcaster.go`:
    - Adicionar constante `NotificationsChannel = "sherlock:notifications"`.
    - Criar método `PublishNotification` que envia o JSON versionado para o Redis.

## ⚡ Onda 2: Lógica de Negócio (API)

### 2.1 Handler de Eventos
- [ ] Criar `backend/internal/handlers/event.go`:
    - Endpoint `POST /v1/events` para agendamento manual/AI.
    - Validação de payload e persistência no banco.
    - Disparo imediato para o Redis Pub/Sub (MVP).

### 2.2 Registro de Rotas
- [ ] Registrar as novas rotas no servidor Echo do backend.

## 🌉 Onda 3: Bridge e Broadcast (WhatsMiau)

### 3.1 Subscriber (WhatsMiau)
- [ ] Atualizar `whatsmeow/server/controllers/lead_sse.go`:
    - Assinar também o canal `sherlock:notifications`.
    - Implementar processamento de eventos de notificação.

### 3.2 SSE Broadcast
- [ ] Garantir que o evento seja repassado para os clientes SSE com o `type` correto para o frontend.

---

## 🧪 Verificação (UAT)
1. **Compilação**: Ambas as aplicações devem compilar sem erros.
2. **Criação de Evento**: Chamada via cURL para `POST /v1/events` deve retornar 201 e salvar no banco.
3. **Efeito Real-time**: Ao criar o evento, o log do `whatsmeow` deve mostrar o recebimento da mensagem via Redis.
4. **SSE**: O endpoint `/admin/leads/events` deve emitir o evento no formato esperado pelo frontend.
