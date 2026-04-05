import { useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { KanbanStatus } from '@/types';

// Payload que o backend envia via SSE quando um lead é movido automaticamente.
// Deve ser mantido em sincronia com kanbanUpdatedEvent em kanban_automation_service.go
interface KanbanUpdatedEvent {
  type: 'lead_kanban_updated';
  lead_id: string;
  new_status: KanbanStatus;
  empresa: string;
}

type OnLeadMovedCallback = (leadId: string, newStatus: KanbanStatus) => void;

const SSE_RECONNECT_DELAY_MS = 5_000;
const SSE_MAX_RECONNECT_DELAY_MS = 60_000;

/**
 * useKanbanRealtime — escuta eventos SSE do backend Sherlock e notifica o
 * componente pai quando um lead é movido automaticamente pelo sistema.
 *
 * Por que SSE e não WebSocket?
 *   - Comunicação é unidirecional (servidor → cliente) — SSE é a ferramenta certa.
 *   - EventSource tem reconexão automática nativa.
 *   - Mais simples que WebSocket para este caso de uso.
 *
 * Autenticação:
 *   - EventSource não suporta headers customizados.
 *   - O JWT é passado como query param ?token=... (mesmo padrão do WS do WhatsMeow).
 *
 * Reconnect:
 *   - Backoff exponencial: 5s → 10s → 20s → ... → 60s máximo.
 *   - Quando a aba volta a ficar visível (visibilitychange), reconecta imediatamente.
 *
 * @param onLeadMoved - callback chamado quando um lead é movido. Deve ser estável
 *   (usar useCallback no componente pai) para evitar re-subscribes desnecessários.
 */
export function useKanbanRealtime(onLeadMoved: OnLeadMovedCallback): void {
  // Ref para a instância EventSource atual — evita re-render ao reconectar
  const esRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(SSE_RECONNECT_DELAY_MS);
  const activeRef = useRef(true);

  // Usa useRef para o callback para evitar que mudanças no onLeadMoved
  // causem reconexão do SSE (o handler é atualizado na ref sem re-subscribe)
  const callbackRef = useRef(onLeadMoved);
  useEffect(() => {
    callbackRef.current = onLeadMoved;
  }, [onLeadMoved]);

  const connect = useCallback(() => {
    if (!activeRef.current) return;

    const token = localStorage.getItem('token');
    if (!token) {
      // Sem token: usuário não está logado, não conectar
      return;
    }

    const apiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000/api/v1';
    const url = `${apiUrl}/events/kanban?token=${encodeURIComponent(token)}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      // Conexão estabelecida — reseta o delay de reconexão
      reconnectDelayRef.current = SSE_RECONNECT_DELAY_MS;
    };

    es.onmessage = (e: MessageEvent) => {
      try {
        const event: KanbanUpdatedEvent = JSON.parse(e.data as string);
        if (event.type === 'lead_kanban_updated') {
          callbackRef.current(event.lead_id, event.new_status);
          // Notificação visual: toast discreto no canto inferior
          toast.success(
            `💬 ${event.empresa} entrou em conversa`,
            {
              id: `kanban-move-${event.lead_id}`, // evita duplicação para o mesmo lead
              duration: 4000,
              position: 'bottom-right',
            }
          );
        }
      } catch {
        // Payload malformado — ignora silenciosamente
      }
    };

    es.onerror = () => {
      // EventSource chama onerror antes de tentar reconectar automaticamente.
      // Fechamos manualmente para controlar o backoff nós mesmos.
      es.close();
      esRef.current = null;

      if (!activeRef.current) return;

      const delay = reconnectDelayRef.current;
      retryTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);

      // Backoff exponencial até o teto
      reconnectDelayRef.current = Math.min(delay * 2, SSE_MAX_RECONNECT_DELAY_MS);
    };
  }, []); // connect nunca recria — usa refs para tudo

  useEffect(() => {
    activeRef.current = true;
    connect();

    // Reconecta imediatamente quando a aba volta a ficar visível
    // (o SSE pode ter sido fechado pelo browser em segundo plano)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && esRef.current === null) {
        reconnectDelayRef.current = SSE_RECONNECT_DELAY_MS; // reseta backoff
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Cleanup: fecha a conexão SSE e cancela qualquer retry pendente
      activeRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);
}
