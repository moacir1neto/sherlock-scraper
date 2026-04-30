import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const getApiBase = () => {
  const raw = import.meta.env.VITE_API_URL || '/v1';
  return raw.endsWith('/v1') ? raw : (raw.replace(/\/+$/, '') + '/v1');
};

interface HandoffAlert {
  type: string;
  chat_id: string;
  lead_name: string;
  instance_id: string;
  remote_jid: string;
}

/**
 * useHandoffSSE — conecta ao endpoint SSE /v1/events/handoff e exibe um
 * toast lateral persistente sempre que o Super Vendedor decide acionar um humano.
 *
 * Implementa reconexão exponencial (2s → 4s → 8s → ... → 60s) para manter
 * a conexão ativa mesmo após quedas de rede ou reinicializações do backend.
 */
export function useHandoffSSE(isAuthenticated: boolean, onHandoff?: (chatId: string) => void) {
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(2000);

  useEffect(() => {
    if (!isAuthenticated) return;

    function connect() {
      const token = localStorage.getItem('token');
      if (!token) return;

      const url = `${getApiBase()}/events/handoff?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        backoffRef.current = 2000; // reset backoff ao conectar com sucesso
      };

      es.onmessage = (event) => {
        try {
          const data: HandoffAlert = JSON.parse(event.data);
          if (data.type === 'handoff_alert') {
            onHandoff?.(data.chat_id);
            const name = data.lead_name || 'Lead';
            toast(
              `🚨 ${name} quer fechar negócio! Assuma o chat.`,
              {
                id: `handoff-${data.chat_id}`,
                duration: Infinity, // toast persiste até o operador fechar manualmente
                position: 'bottom-right',
                style: {
                  background: '#1a1a1a',
                  color: '#fff',
                  border: '1px solid #ef4444',
                  fontWeight: 500,
                },
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            );
          }
        } catch {
          // Ignora mensagens malformadas (ex: heartbeat)
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;

        // Reconexão com backoff exponencial (máximo 60s)
        const delay = Math.min(backoffRef.current, 60000);
        backoffRef.current = Math.min(backoffRef.current * 2, 60000);

        retryRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [isAuthenticated, onHandoff]);
}
