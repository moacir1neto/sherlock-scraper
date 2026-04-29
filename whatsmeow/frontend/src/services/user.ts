import api from './api';
import { User } from '../types';

export const userService = {
  updateProfile: async (data: { nome?: string; email?: string; password?: string }): Promise<User> => {
    const token = localStorage.getItem('token');
    const response = await api.put<User>('/users/me', data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  /** Lista usuários da empresa (admin) ou todos (super_admin). Use adminService.listUsers() ou superAdminService.listUsers() conforme a tela. */
  list: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/admin/users');
    return response.data;
  },
};
