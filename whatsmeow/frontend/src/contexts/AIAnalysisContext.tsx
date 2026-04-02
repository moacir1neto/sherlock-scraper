import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';
import { leadsService } from '../services/leads';
import { sherlockService } from '../services/sherlock';
import type { Lead } from '../types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AnalysisJob {
  scrapeId: string;
  pending: Set<string>; // IDs ainda aguardando dossiê
  total: number;        // total enviado para análise
}

type LeadsListener = (leads: Lead[]) => void;

interface AIAnalysisContextValue {
  /** Conjunto global de IDs sendo analisados no momento */
  analyzingIds: Set<string>;
  /** Inicia análise em lote e registra o job globalmente */
  startBulkAnalysis: (ids: string[], scrapeId: string) => Promise<void>;
  /** LeadsView registra um callback para receber leads frescos durante o polling */
  subscribe: (scrapeId: string, cb: LeadsListener) => () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AIAnalysisContext = createContext<AIAnalysisContextValue | null>(null);

const POLL_INTERVAL_MS = 8000;

export function AIAnalysisProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const listeners = useRef<Map<string, LeadsListener>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Conjunto derivado de todos os IDs pendentes
  const analyzingIds: Set<string> = new Set(
    jobs.flatMap((j) => Array.from(j.pending))
  );

  // ── Polling ────────────────────────────────────────────────────────────────

  const runPoll = useCallback(async (currentJobs: AnalysisJob[]) => {
    if (currentJobs.length === 0) return;

    const updatedJobs: AnalysisJob[] = [];

    for (const job of currentJobs) {
      try {
        const res = await sherlockService.getLeadsByScrape(job.scrapeId);
        const freshLeads: Lead[] = res.data.leads ?? [];

        // Notifica o LeadsView se estiver montado
        listeners.current.get(job.scrapeId)?.(freshLeads);

        // Remove do pending os que já têm dossiê
        const stillPending = new Set(job.pending);
        for (const id of job.pending) {
          const lead = freshLeads.find((l) => l.id === id);
          if (lead?.ai_analysis) stillPending.delete(id);
        }

        if (stillPending.size === 0) {
          // Job concluído — dispara toast de finalização
          toast.success(
            `🧠 Dossiê IA pronto! ${job.total} lead${job.total !== 1 ? 's' : ''} analisado${job.total !== 1 ? 's' : ''}.`,
            { duration: 6000 }
          );
        } else {
          updatedJobs.push({ ...job, pending: stillPending });
        }
      } catch {
        // Mantém o job para tentar no próximo ciclo
        updatedJobs.push(job);
      }
    }

    setJobs(updatedJobs);
  }, []);

  // Inicia/para o intervalo conforme existem jobs
  useEffect(() => {
    if (jobs.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setJobs((current) => {
          runPoll(current);
          return current; // estado real atualizado dentro do runPoll via setJobs
        });
      }, POLL_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobs.length, runPoll]);

  // ── API pública ────────────────────────────────────────────────────────────

  const startBulkAnalysis = useCallback(async (ids: string[], scrapeId: string) => {
    await leadsService.analyzeBulk(ids);

    const newJob: AnalysisJob = {
      scrapeId,
      pending: new Set(ids),
      total: ids.length,
    };

    setJobs((prev) => {
      // Merge com job existente da mesma campanha, se houver
      const existing = prev.find((j) => j.scrapeId === scrapeId);
      if (existing) {
        const merged = new Set([...existing.pending, ...ids]);
        return prev.map((j) =>
          j.scrapeId === scrapeId
            ? { ...j, pending: merged, total: j.total + ids.length }
            : j
        );
      }
      return [...prev, newJob];
    });

    toast.success(
      `🧠 IA trabalhando em ${ids.length} lead${ids.length !== 1 ? 's' : ''}. Pode navegar à vontade!`,
      { duration: 4000 }
    );
  }, []);

  const subscribe = useCallback((scrapeId: string, cb: LeadsListener) => {
    listeners.current.set(scrapeId, cb);
    return () => listeners.current.delete(scrapeId);
  }, []);

  return (
    <AIAnalysisContext.Provider value={{ analyzingIds, startBulkAnalysis, subscribe }}>
      {children}
    </AIAnalysisContext.Provider>
  );
}

export function useAIAnalysis() {
  const ctx = useContext(AIAnalysisContext);
  if (!ctx) throw new Error('useAIAnalysis must be used inside AIAnalysisProvider');
  return ctx;
}
