import { api } from './api';
import type { AISettingsConfig } from '../types';

export const aiSettingsService = {
  get: () =>
    api.get<AISettingsConfig>('/admin/ai-settings'),

  save: (data: Omit<AISettingsConfig, 'company_id' | 'updated_at'>) =>
    api.put<AISettingsConfig>('/admin/ai-settings', data),
};
