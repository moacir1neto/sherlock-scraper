# PLAN - Phase 4: Business Event Notifications (Wave 4 - Frontend)

## Context
As ondas de infraestrutura (Ondas 1, 2 e 3) foram concluídas e validadas com 100% de sucesso. O backend já persiste eventos, agenda lembretes no Asynq e transmite via SSE com multi-tenancy.
O objetivo agora é dar visibilidade a esses eventos no CRM Sherlock.

## User Acceptance Criteria (UAT)
- [ ] Sino de notificações exibe contador de não lidas.
- [ ] Clique no sino abre dropdown com histórico recente.
- [ ] Toast visual aparece instantaneamente ao receber evento SSE (MEETING_SCHEDULED).
- [ ] Timeline do lead exibe eventos de negócio (reuniões agendadas/canceladas).
- [ ] Notificações são filtradas corretamente por empresa (multi-tenancy visual).

## Implementation Plan

### Wave 4: Frontend & UX Real-time

#### Wave 4.1: SSE Client & Global Store
- [ ] Implementar `NotificationStore` (Zustand/Context) no frontend.
- [ ] Conectar ao endpoint SSE do WhatsMiau (`/v1/admin/leads/events`).
- [ ] Garantir reconexão automática e gestão de token JWT.

#### Wave 4.2: Notification Bell & Dropdown
- [ ] Criar componente `NotificationBell` com badge dinâmico.
- [ ] Criar `NotificationList` com cards estilizados por tipo de evento.
- [ ] Integrar no Header principal do CRM.

#### Wave 4.3: Real-time Toasts (Sonner/Radix)
- [ ] Implementar disparador de Toasts baseado em eventos SSE.
- [ ] Diferenciar visualmente: Agendamento (Info), Lembrete (Warning), Cancelamento (Error).

#### Wave 4.4: Lead Timeline Update
- [ ] Atualizar o modal de detalhes do Lead para exibir `BusinessEvents`.
- [ ] Renderizar ícones específicos para reuniões e follow-ups.

## Verification Plan

### Automated Tests
- [ ] Mock de SSE stream para validar renderização de toasts.
- [ ] Teste unitário de filtragem de notificações na Store.

### Manual Verification (UAT)
- [ ] Disparar `curl` no backend e verificar se o toast aparece no browser.
- [ ] Abrir dropdown do sino e validar se o evento persiste na lista local.
- [ ] Cancelar reunião e ver se a timeline do lead atualiza (ou remove).

## Safety & Rollback
- **Rollback Strategy**: O frontend é desacoplado. Se o SSE falhar, as notificações apenas param de chegar em real-time, sem quebrar o CRM.
- **Circuit Breaker**: Limitar histórico local a 50 notificações para evitar consumo excessivo de memória.
