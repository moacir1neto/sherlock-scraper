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
            ? { ...l, ai_analysis: res.data.analysis }
            : l
        )
      );

      toast.success('🤖 Análise de IA gerada com sucesso!');
      return res.data.analysis;
    } catch (error: any) {
      const backendError = error.response?.data?.error || '';
      if (error.response?.status === 400 && backendError === 'lead is being enriched') {
        toast.error('Este lead está sendo enriquecido no momento. Aguarde a conclusão e tente novamente.', {
          duration: 5000,
        });
      } else {
        toast.error(backendError || 'Falha ao gerar análise de IA');
      }
      throw error;
    }
  }, [leads]);

  const analyzeLeadsBulk = useCallback(async (leadIds: string[]) => {
    try {
      await axios.post(
        `${API_URL()}/protected/leads/analyze/bulk`,
        { lead_ids: leadIds },
        { headers: authHeaders() }
      );
      toast.success(`${leadIds.length} leads enviados para análise neural!`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Falha ao processar análise em massa';
      toast.error(errorMsg);
      throw error;
    }
  }, []);

  const deleteLead = useCallback(async (leadId: string) => {
    const originalLeads = [...leads];
    setLeads((prev: Lead[]) => prev.filter((l: Lead) => l.ID !== leadId));

    try {
      await axios.delete(`${API_URL()}/protected/leads/${leadId}`, {
        headers: authHeaders(),
      });
      toast.success('Negócio excluído com sucesso');
      return true;
    } catch {
      toast.error('Falha ao excluir negócio. Revertendo...');
      setLeads(originalLeads);
      return false;
    }
  }, [leads]);

  const duplicateLead = useCallback(async (lead: Lead) => {
    const payload: Record<string, unknown> = {
      company_name: `${lead.Empresa} - Cópia`,
      stage_id: lead.KanbanStatus,
    };
    if (lead.Nicho) payload.nicho = lead.Nicho;
    if (lead.estimated_value && lead.estimated_value > 0) {
      payload.estimated_value = Number(lead.estimated_value);
    }
    if (lead.due_date) payload.due_date = lead.due_date;
    if (lead.tags) payload.tags = lead.tags;

    // Additional fields to copy
    if (lead.Endereco) (payload as any).endereco = lead.Endereco;
    if (lead.Telefone) (payload as any).telefone = lead.Telefone;
    if (lead.TipoTelefone) (payload as any).tipo_telefone = lead.TipoTelefone;
    if (lead.Email) (payload as any).email = lead.Email;
    if (lead.Site) (payload as any).site = lead.Site;
    if (lead.Instagram) (payload as any).instagram = lead.Instagram;
    if (lead.Facebook) (payload as any).facebook = lead.Facebook;
    if (lead.LinkedIn) (payload as any).linkedin = lead.LinkedIn;
    if (lead.TikTok) (payload as any).tiktok = lead.TikTok;
    if (lead.YouTube) (payload as any).youtube = lead.YouTube;
    if (lead.ResumoNegocio) (payload as any).resumo_negocio = lead.ResumoNegocio;
    if (lead.Rating) (payload as any).rating = lead.Rating;
    if (lead.QtdAvaliacoes) (payload as any).qtd_avaliacoes = lead.QtdAvaliacoes;

    try {
      const res = await axios.post(`${API_URL()}/protected/leads`, payload, {
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      toast.success('Negócio duplicado com sucesso!');
      const newLead = res.data;
      setLeads((prev: Lead[]) => [newLead, ...prev]);
      return newLead;
    } catch {
      toast.error('Falha ao duplicar negócio');
      return null;
    }
  }, []);

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
    if (data.endereco) payload.endereco = data.endereco;
    if (data.telefone) payload.telefone = data.telefone;
    if (data.tipo_telefone) payload.tipo_telefone = data.tipo_telefone;
    if (data.email) payload.email = data.email;
    if (data.site) payload.site = data.site;
    if (data.instagram) payload.instagram = data.instagram;
    if (data.facebook) payload.facebook = data.facebook;
    if (data.linkedin) payload.linkedin = data.linkedin;
    if (data.tiktok) payload.tiktok = data.tiktok;
    if (data.youtube) payload.youtube = data.youtube;
    if (data.resumo_negocio) payload.resumo_negocio = data.resumo_negocio;
    if (data.rating) payload.rating = data.rating;
    if (data.qtd_avaliacoes) payload.qtd_avaliacoes = data.qtd_avaliacoes;

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

  const enrichCNPJ = useCallback(async (leadId: string) => {
    try {
      const res = await axios.post(
        `${API_URL()}/protected/leads/${leadId}/enrich-cnpj`,
        {},
        { headers: authHeaders() }
      );

      const cnpj = res.data.result?.cnpj;
      if (cnpj) {
        // Update local lead state with the new CNPJ
        setLeads((prev: Lead[]) =>
          prev.map((l: Lead) =>
            l.ID === leadId ? { ...l, CNPJ: cnpj } : l
          )
        );
        toast.success(`CNPJ encontrado: ${cnpj}`);
      }

      return res.data.result;
    } catch (error: any) {
      const msg = error.response?.data?.message || 'CNPJ não encontrado';
      toast.error(msg);
      throw error;
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
    deleteLead,
    duplicateLead,
    deleteScrapeJob,
    analyzeLead,
    analyzeLeadsBulk,
    enrichCNPJ,
    setLeads
  };
}
