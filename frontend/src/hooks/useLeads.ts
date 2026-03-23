import { useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Lead, KanbanStatus, ScrapingJob } from '@/types';

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
    setLeads(prev =>
      prev.map(l => (l.ID === leadId ? { ...l, KanbanStatus: newStatus } : l))
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
    setLeads(prev =>
      prev.map(l => (l.ID === updatedLead.ID ? updatedLead : l))
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
      setScrapeJobs(prev => prev.filter(job => job.ID !== jobId));
      toast.success('Raspagem excluída com sucesso');
    } catch {
      toast.error('Falha ao excluir raspagem');
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
    deleteScrapeJob,
    setLeads 
  };
}
