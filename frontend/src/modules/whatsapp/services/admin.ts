import api from './api';
import { User, Company } from '../types';

export const adminService = {
  listUsers: async (): Promise<User[]> => {
    const token = localStorage.getItem('token');
    const response = await api.get<User[]>('/admin/users', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  getUserById: async (id: string): Promise<User> => {
    const token = localStorage.getItem('token');
    const response = await api.get<User>(`/admin/users/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  createUser: async (user: Omit<User, 'id' | 'created_at' | 'updated_at'> & { password: string }): Promise<User> => {
    const token = localStorage.getItem('token');
    const response = await api.post<User>('/admin/users', user, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  updateUser: async (id: string, user: Partial<User> & { password?: string }): Promise<User> => {
    const token = localStorage.getItem('token');
    const response = await api.put<User>(`/admin/users/${id}`, user, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    const token = localStorage.getItem('token');
    await api.delete(`/admin/users/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  getCompany: async (): Promise<Company> => {
    const token = localStorage.getItem('token');
    const response = await api.get<Company>('/admin/company', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  getCompanyProfile: async (): Promise<Company> => {
    const token = localStorage.getItem('token');
    const response = await api.get<Company[]>('/admin/company', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return Array.isArray(response.data) ? response.data[0] : response.data;
  },

  updateCompany: async (company: Partial<Company>): Promise<Company> => {
    const token = localStorage.getItem('token');
    const response = await api.put<Company>('/admin/company', company, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },
};

