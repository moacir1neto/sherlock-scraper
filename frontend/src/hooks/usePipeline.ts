import { useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AIPipelineResponse } from '@/types';

const API_URL = () => import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const getToken = () => localStorage.getItem('token');
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

export function usePipeline() {
  const [loading, setLoading] = useState(false);

  const generatePipelineWithAI = useCallback(async (niche: string): Promise<AIPipelineResponse> => {
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL()}/protected/pipeline/generate-ai`,
        { niche },
        { headers: authHeaders() }
      );
      return res.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Falha ao gerar pipeline com IA';
      toast.error(errorMsg);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPipeline = useCallback(async (): Promise<AIPipelineResponse | null> => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL()}/protected/pipeline`,
        { headers: authHeaders() }
      );
      if (res.data && res.data.pipeline_name) {
        return res.data;
      }
      return null;
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Falha ao buscar pipeline:', error);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    generatePipelineWithAI,
    fetchPipeline,
    loading
  };
}
