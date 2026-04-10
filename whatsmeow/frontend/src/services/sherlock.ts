import { api } from './api';
import type { Scrape, Lead } from '../types';

export interface ExtractResponse {
  scrape_id: string;
  status: string;
  message: string;
}

export const sherlockService = {
  // Inicia uma campanha de raspagem — retorna scrape_id imediatamente
  extract: (data: { keyword: string; location: string; limit?: number }) =>
    api.post<ExtractResponse>('/admin/sherlock/extract', data),

  // Lista todas as campanhas da empresa
  listScrapes: () =>
    api.get<{ scrapes: Scrape[] }>('/admin/sherlock/scrapes'),

  // Retorna status e total_leads de uma campanha específica
  getScrape: (id: string) =>
    api.get<Scrape>(`/admin/sherlock/scrapes/${id}`),

  // Remove uma campanha e todos seus leads
  deleteScrape: (id: string) =>
    api.delete(`/admin/sherlock/scrapes/${id}`),

  // Leads de uma campanha específica
  getLeadsByScrape: (scrapeId: string) =>
    api.get<{ leads: Lead[]; total: number }>(`/admin/leads/scrape/${scrapeId}`),
};
