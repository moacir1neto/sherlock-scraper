import api from './api';
import { SuperAdminInstance, User } from '../types';

export const superAdminService = {
  listInstances: async (): Promise<SuperAdminInstance[]> => {
    const response = await api.get<SuperAdminInstance[]>('/super-admin/instances');
    return response.data;
  },

  deleteInstance: async (id: string): Promise<void> => {
    await api.delete(`/super-admin/instances/${id}`);
  },

  listUsers: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/super-admin/users');
    return response.data;
  },

  getUserById: async (id: string): Promise<User> => {
    const response = await api.get<User>(`/super-admin/users/${id}`);
    return response.data;
  },

  createUser: async (user: Omit<User, 'id' | 'created_at' | 'updated_at'> & { password: string }): Promise<User> => {
    const response = await api.post<User>('/super-admin/users', user);
    return response.data;
  },

  updateUser: async (id: string, user: Partial<User> & { password?: string }): Promise<User> => {
    const response = await api.put<User>(`/super-admin/users/${id}`, user);
    return response.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/super-admin/users/${id}`);
  },
};

