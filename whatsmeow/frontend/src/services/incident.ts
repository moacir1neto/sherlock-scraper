import api from './api';
import { Incident } from '../types';

export interface IncidentListResponse {
  items: Incident[];
  total: number;
}

export const incidentService = {
  list: async (params?: { limit?: number; offset?: number; code?: string; tenant_id?: string }): Promise<IncidentListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.limit != null) searchParams.set('limit', String(params.limit));
    if (params?.offset != null) searchParams.set('offset', String(params.offset));
    if (params?.code) searchParams.set('code', params.code);
    if (params?.tenant_id) searchParams.set('tenant_id', params.tenant_id);
    const qs = searchParams.toString();
    const url = qs ? `/super-admin/incidents?${qs}` : '/super-admin/incidents';
    const response = await api.get<IncidentListResponse>(url);
    return response.data;
  },

  getById: async (id: string): Promise<Incident> => {
    const response = await api.get<Incident>(`/super-admin/incidents/${id}`);
    return response.data;
  },
};
