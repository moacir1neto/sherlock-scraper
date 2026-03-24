import { useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Lead, KanbanStatus, ScrapingJob, CreateLeadPayload } from '@/types';

const API_URL = () => import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const getToken = () => localStorage.getItem('token');
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [scrapeJobs, setScrapeJobs] = useState<ScrapingJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async (jobID?: string) => {
    setLoading(true);
    try {
      const url = jobID 
        ? `${API_URL()}/protected/scrapes/${jobID}/leads`
        : `${API_URL()}/protected/leads`;
        
      const res = await axios.get(url, { headers: authHeaders() });
      setLeads(res.data.leads || []);
    } catch {
      toast.error('Falha ao carregar leads');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchScrapeJobs = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL()}/protected/scrapes`, {
        headers: authHeaders(),
      });
      setScrapeJobs(res.data.jobs || []);
    } catch {
      toast.error('Falha ao carregar campanhas');
    }
  }, []);

  const updateStatus = useCallback(async (leadId: string, newStatus: KanbanStatus) => {
    const originalLeads = [...leads];
    
    // Optimistic update
    setLeads((prev: Lead[]) =>
      prev.map((l: Lead) => (l.ID === leadId ? { ...l, KanbanStatus: newStatus } : l))
    );

    try {
      await axios.patch(
        `${API_URL()}/protected/leads/${leadId}/status`,
        { status: newStatus },
        { headers: authHeaders() }
      );
    } catch {
      toast.error('Falha ao atualizar status. Revertendo...');
      setLeads(originalLeads);
    }
  }, [leads]);

  const updateLead = useCallback(async (updatedLead: Lead) => {
    const originalLeads = [...leads];
    
    // Optimistic update
    setLeads((prev: Lead[]) =>
      prev.map((l: Lead) => (l.ID === updatedLead.ID ? updatedLead : l))
    );

    try {
      await axios.put(
        `${API_URL()}/protected/leads/${updatedLead.ID}`,
        updatedLead,
        { headers: authHeaders() }
      );
    } catch {
      toast.error('Falha ao salvar alterações. Revertendo...');
      setLeads(originalLeads);
    }
  }, [leads]);

  const deleteScrapeJob = useCallback(async (jobId: string) => {
    try {
      await axios.delete(`${API_URL()}/protected/scrapes/${jobId}`, {
        headers: authHeaders(),
      });
      setScrapeJobs((prev: ScrapingJob[]) => prev.filter((job: ScrapingJob) => job.ID !== jobId));
      toast.success('Raspagem excluída com sucesso');
    } catch {
      toast.error('Falha ao excluir raspagem');
    }
  }, []);

  const analyzeLead = useCallback(async (leadId: string, skill: string = 'raiox') => {
    try {
      const res = await axios.post(
        `${API_URL()}/protected/leads/${leadId}/analyze?skill=${skill}`,
        {},
        { headers: authHeaders() }
      );

      // Atualiza o lead local com a análise recebida
      setLeads((prev: Lead[]) =>
        prev.map((l: Lead) =>
          l.ID === leadId
            ? { ...l, AIAnalysis: res.data.analysis }
            : l
        )
      );

      toast.success('🤖 Análise de IA gerada com sucesso!');
      return res.data.analysis;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Falha ao gerar análise de IA';
      toast.error(errorMsg);
      throw error;
    }
  }, [leads]);

  const createLead = useCallback(async (data: CreateLeadPayload) => {
    // Normalize: ensure estimated_value is a clean number, strip undefined fields
    const payload: Record<string, unknown> = {
      company_name: data.company_name,
      stage_id: data.stage_id,
    };
    if (data.nicho) payload.nicho = data.nicho;
    if (data.estimated_value && data.estimated_value > 0) {
      payload.estimated_value = Number(data.estimated_value);
    }
    if (data.due_date) payload.due_date = data.due_date;
    if (data.tags) payload.tags = data.tags;
    if (data.linked_lead_id) payload.linked_lead_id = data.linked_lead_id;

    try {
      const url = `${API_URL()}/protected/leads`;
      console.log('[createLead] POST', url, payload);
      const res = await axios.post(url, payload, {
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      toast.success('Negócio criado com sucesso!');
      const newLead = res.data;
      setLeads((prev: Lead[]) => [newLead, ...prev]);
      return newLead;
    } catch (error: any) {
      console.error('[createLead] Error:', error.response?.status, error.response?.data);
      const errorMsg = error.response?.data?.error || 'Falha ao criar negócio';
      toast.error(errorMsg);
      return null;
    }
  }, []);

  return {
    leads,
    scrapeJobs,
    loading,
    fetchLeads,
    fetchScrapeJobs,
    updateStatus,
    updateLead,
    createLead,
    deleteScrapeJob,
    analyzeLead,
    setLeads
  };
}
