import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';

export interface CampaignLogEvent {
  id: string;
  type: 'start' | 'success' | 'error' | 'skip';
  lead_id: string;
  empresa: string;
  message: string;
}

interface BulkCampaignState {
  campaignId: string | null;
  total: number;
  progress: number;
  logs: CampaignLogEvent[];
  isSending: boolean;
  isComplete: boolean;
}

interface BulkCampaignContextValue extends BulkCampaignState {
  startTracking: (campaignId: string, total: number) => void;
  reset: () => void;
}

const BulkCampaignContext = createContext<BulkCampaignContextValue | null>(null);

export const BulkCampaignProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<BulkCampaignState>({
    campaignId: null,
    total: 0,
    progress: 0,
    logs: [],
    isSending: false,
    isComplete: false,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const totalRef = useRef(0);

  const closeSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    closeSSE();
    setState({
      campaignId: null,
      total: 0,
      progress: 0,
      logs: [],
      isSending: false,
      isComplete: false,
    });
    totalRef.current = 0;
  }, [closeSSE]);

  const startTracking = useCallback((campaignId: string, total: number) => {
    closeSSE();
    totalRef.current = total;

    setState({
      campaignId,
      total,
      progress: 0,
      logs: [],
      isSending: true,
      isComplete: false,
    });

    const token = localStorage.getItem('token');
    const sherlockUrl = (import.meta.env.VITE_SHERLOCK_API_URL as string) || 'http://localhost:3005/api/v1';
    const baseUrl = sherlockUrl.replace(/\/+$/, '');
    const es = new EventSource(`${baseUrl}/campaigns/${campaignId}/stream?token=${token || ''}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Omit<CampaignLogEvent, 'id'>;
        const logEvent: CampaignLogEvent = {
          ...data,
          id: `${Date.now()}-${Math.random()}`,
        };

        setState((prev) => {
          let newLogs = [...prev.logs];
          let newProgress = prev.progress;

          if (logEvent.type !== 'start') {
            newLogs = newLogs.filter(
              (l) => !(l.lead_id === logEvent.lead_id && l.type === 'start')
            );
            newProgress = Math.min(newProgress + 1, totalRef.current);
          }

          newLogs = [...newLogs, logEvent];
          const isComplete = newProgress >= totalRef.current && totalRef.current > 0;

          if (isComplete) {
            es.close();
            eventSourceRef.current = null;
            const successCount = newLogs.filter((l) => l.type === 'success').length;
            const errorCount = newLogs.filter((l) => l.type === 'error').length;
            const skipCount = newLogs.filter((l) => l.type === 'skip').length;
            toast.success(
              `Disparo concluído: ${successCount} enviados, ${skipCount} ignorados, ${errorCount} erros.`,
              { duration: 6000 }
            );
          }

          return {
            ...prev,
            logs: newLogs,
            progress: newProgress,
            isSending: !isComplete,
            isComplete,
          };
        });
      } catch (err) {
        console.error('Erro ao processar evento SSE', err);
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setState((prev) => ({ ...prev, isSending: false }));
    };
  }, [closeSSE]);

  useEffect(() => () => closeSSE(), [closeSSE]);

  return (
    <BulkCampaignContext.Provider value={{ ...state, startTracking, reset }}>
      {children}
    </BulkCampaignContext.Provider>
  );
};

export function useBulkCampaign(): BulkCampaignContextValue {
  const ctx = useContext(BulkCampaignContext);
  if (!ctx) throw new Error('useBulkCampaign must be used within BulkCampaignProvider');
  return ctx;
}
