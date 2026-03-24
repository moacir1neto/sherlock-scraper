import { useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AIPipelineResponse } from '@/types';

const API_URL = () => import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

export function usePipeline() {
  const [loading, setLoading] = useState(false);

  const generatePipelineWithAI = useCallback(async (niche: string): Promise<AIPipelineResponse> => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) {
      toast.error('Sessão expirada. Faça login novamente.');
      throw new Error('No auth token');
    }

    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL()}/protected/pipeline/generate-ai`,
        { niche },
        { headers }
      );
      return {
        ...res.data,
        pipeline_name: res.data.pipeline_name || res.data.name
      };
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error('Sessão expirada. Faça login novamente.');
      } else {
        const errorMsg = error.response?.data?.error || 'Falha ao gerar pipeline com IA';
        toast.error(errorMsg);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPipeline = useCallback(async (): Promise<AIPipelineResponse | null> => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) {
      return null;
    }

    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL()}/protected/pipeline`,
        { headers }
      );
      if (res.data && (res.data.pipeline_name || res.data.name)) {
        return {
          ...res.data,
          pipeline_name: res.data.pipeline_name || res.data.name
        };
      }
      return null;
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.warn('Pipeline fetch: token inválido ou expirado');
        throw error; // Re-throw 401 so callers can redirect to login
      } else if (error.response?.status !== 404) {
        console.error('Falha ao buscar pipeline:', error);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePipeline = useCallback(async (): Promise<boolean> => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) {
      return false;
    }

    setLoading(true);
    try {
      await axios.delete(
        `${API_URL()}/protected/pipeline`,
        { headers }
      );
      localStorage.removeItem('pipeline_generated');
      toast.success('Pipeline excluído com sucesso!');
      return true;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Falha ao excluir pipeline';
      toast.error(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const createPipeline = useCallback(async (data: { name: string, stages: any[] }): Promise<AIPipelineResponse | null> => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) {
      return null;
    }

    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL()}/protected/pipeline`,
        data,
        { headers }
      );
      localStorage.setItem('pipeline_generated', 'true');
      toast.success('Pipeline criado com sucesso!');
      return {
        ...res.data,
        pipeline_name: res.data.pipeline_name || res.data.name
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Falha ao criar pipeline';
      toast.error(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    generatePipelineWithAI,
    fetchPipeline,
    deletePipeline,
    createPipeline,
    loading
  };
}
