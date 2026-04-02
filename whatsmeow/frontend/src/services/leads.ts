import api from './api';
import type { AIAnalysis, KanbanStatus, Lead, LeadListResponse } from '../types';

export interface CreateLeadRequest {
  source_id?: string;
  name: string;
  phone?: string;
  address?: string;
  website?: string;
  email?: string;
  rating?: number;
  reviews?: number;
}

export interface BulkCreateLeadsRequest {
  source_id?: string;
  leads: CreateLeadRequest[];
}

export interface UpdateLeadRequest {
  name: string;
  phone?: string;
  address?: string;
  website?: string;
  email?: string;
  kanban_status?: KanbanStatus;
  notes?: string;
  estimated_value?: number;
  tags?: string;
}

export const leadsService = {
  list: (params?: { status?: string; page?: number }) =>
    api.get<LeadListResponse>('/admin/leads', { params }),

  create: (data: CreateLeadRequest) =>
    api.post<Lead>('/admin/leads', data),

  bulkCreate: (data: BulkCreateLeadsRequest) =>
    api.post<{ created: number }>('/admin/leads/bulk', data),

  getById: (id: string) =>
    api.get<Lead>(`/admin/leads/${id}`),

  update: (id: string, data: UpdateLeadRequest) =>
    api.put<Lead>(`/admin/leads/${id}`, data),

  updateStatus: (id: string, kanban_status: KanbanStatus) =>
    api.patch<{ status: string }>(`/admin/leads/${id}/status`, { kanban_status }),

  delete: (id: string) =>
    api.delete(`/admin/leads/${id}`),

  // Gera dossiê de inteligência IA para um lead
  analyze: (id: string, skill: 'raiox' | 'email' | 'call' = 'raiox') =>
    api.post<AIAnalysis>(`/admin/leads/${id}/analyze?skill=${skill}`),

  // Gera dossiês em lote para múltiplos leads
  analyzeBulk: (ids: string[], skill: 'raiox' | 'email' | 'call' = 'raiox') =>
    api.post<{ processed: number; failed: number }>('/admin/leads/analyze/bulk', { ids, skill }),
};
