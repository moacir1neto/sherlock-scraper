import api from './api';
import { Company } from '../types';

export const companyService = {
  list: async (): Promise<Company[]> => {
    const token = localStorage.getItem('token');
    const response = await api.get<Company[]>('/super-admin/companies', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  getById: async (id: string): Promise<Company> => {
    const token = localStorage.getItem('token');
    const response = await api.get<Company>(`/super-admin/companies/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  create: async (company: Omit<Company, 'id' | 'created_at' | 'updated_at'>): Promise<Company> => {
    const token = localStorage.getItem('token');
    const response = await api.post<Company>('/super-admin/companies', company, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  update: async (id: string, company: Partial<Company>): Promise<Company> => {
    const token = localStorage.getItem('token');
    const response = await api.put<Company>(`/super-admin/companies/${id}`, company, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    const token = localStorage.getItem('token');
    await api.delete(`/super-admin/companies/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },
};

