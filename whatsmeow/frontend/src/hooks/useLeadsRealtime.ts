import { useEffect, useRef } from 'react';

interface KanbanUpdatedEvent {
  type: 'lead_kanban_updated';
  lead_id: string;
  new_status: string;
  empresa: string;
}

/**
 * useLeadsRealtime — conecta ao endpoint SSE do WhatsMeow para receber
 * notificações em tempo real de movimentações de Kanban feitas pelo Sherlock.
 *
 * Quando uma mensagem WhatsApp é recebida por um lead, o Sherlock muda o
 * status desse lead e publica um evento Redis → WhatsMeow retransmite via SSE
 * → este hook chama onLeadUpdated para atualizar o estado local do React.
 *
 * @param onLeadUpdated  Callback chamado com (leadId, newStatus) ao receber evento.
 */
export function useLeadsRealtime(
  onLeadUpdated: (leadId: string, newStatus: string) => void
) {
  const esRef = useRef<EventSource | null>(null);
  // Ref para evitar que o useEffect feche em torno de uma versão stale do callback
  const callbackRef = useRef(onLeadUpdated);
  callbackRef.current = onLeadUpdated;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '/v1';
    const url = `${baseUrl}/admin/leads/events?token=${encodeURIComponent(token)}`;

    let backoffMs = 1000;
    let timeoutId: ReturnType<typeof setTimeout>;
    let active = true;

    function connect() {
      if (!active) return;

      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        backoffMs = 1000; // reset backoff on successful connection
      };

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as KanbanUpdatedEvent;
          if (data.type === 'lead_kanban_updated') {
            callbackRef.current(data.lead_id, data.new_status);
          }
        } catch {
          // ignore malformed events
        }
      };

      es.onerror = () => {
        es.close();
        if (!active) return;
        timeoutId = setTimeout(() => {
          backoffMs = Math.min(backoffMs * 2, 30_000);
          connect();
        }, backoffMs);
      };
    }

    connect();

    // Reconecta imediatamente ao retornar para a aba (evita conexões mortas).
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && esRef.current?.readyState === EventSource.CLOSED) {
        clearTimeout(timeoutId);
        backoffMs = 1000;
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      clearTimeout(timeoutId);
      esRef.current?.close();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []); // [] — sem dependências: token é lido de localStorage, callback via ref
}
