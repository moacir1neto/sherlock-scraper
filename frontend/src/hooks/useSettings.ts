import { useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CompanySetting } from '@/types';

const API_URL = () => import.meta.env.VITE_API_URL || 'http://localhost:3005/api/v1';
const getToken = () => localStorage.getItem('token');
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

export function useSettings() {
  const [settings, setSettings] = useState<CompanySetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL()}/protected/settings`, {
        headers: authHeaders(),
      });
      setSettings(res.data.settings);
    } catch {
      toast.error('Falha ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (data: Partial<CompanySetting>) => {
    setSaving(true);
    try {
      const res = await axios.put(`${API_URL()}/protected/settings`, data, {
        headers: authHeaders(),
      });
      setSettings(res.data.settings);
      toast.success('Configurações salvas com sucesso!');
    } catch {
      toast.error('Falha ao salvar configurações');
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, loading, saving, fetchSettings, updateSettings };
}
