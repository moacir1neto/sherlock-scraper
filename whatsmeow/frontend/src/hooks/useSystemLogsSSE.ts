import { useEffect, useRef, useCallback } from 'react';

const getApiBase = () => {
  const raw = import.meta.env.VITE_API_URL || '/v1';
  return raw.endsWith('/v1') ? raw : raw.replace(/\/+$/, '') + '/v1';
};

export type LogLevel = 'info' | 'warn' | 'error';
export type LogCategory = 'system' | 'whatsapp' | 'campaign' | 'agent';

export interface SystemLogEntry {
  type: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  detail?: string;
  instance?: string;
  timestamp: string;
}

/**
 * useSystemLogsSSE — conecta ao endpoint SSE /v1/events/system-logs e
 * chama onLog para cada evento recebido.
 *
 * Reconexão exponencial: 2s → 4s → 8s → ... → 60s.
 * Só conecta se isAuthenticated && isSuperAdmin.
 */
export function useSystemLogsSSE(
  isAuthenticated: boolean,
  isSuperAdmin: boolean,
  onLog: (entry: SystemLogEntry) => void,
) {
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(2000);
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const url = `${getApiBase()}/events/system-logs?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      backoffRef.current = 2000;
    };

    es.onmessage = (event) => {
      try {
        const data: SystemLogEntry = JSON.parse(event.data);
        if (data.type === 'system_log') {
          onLogRef.current(data);
        }
      } catch {
        // heartbeat ou mensagem malformada — ignora
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      const delay = Math.min(backoffRef.current, 60000);
      backoffRef.current = Math.min(backoffRef.current * 2, 60000);
      retryRef.current = setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isSuperAdmin) return;
    connect();
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [isAuthenticated, isSuperAdmin, connect]);
}
