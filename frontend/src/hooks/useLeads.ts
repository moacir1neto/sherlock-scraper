import { useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Lead, KanbanStatus } from '@/types';

const API_URL = () => import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const getToken = () => localStorage.getItem('token');
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL()}/protected/leads`, {
        headers: authHeaders(),
      });
      setLeads(res.data.leads || []);
    } catch {
      toast.error('Falha ao carregar leads');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStatus = useCallback(async (leadId: string, newStatus: KanbanStatus) => {
    // Optimistic update
    setLeads(prev =>
      prev.map(l => (l.ID === leadId ? { ...l, KanbanStatus: newStatus } : l))
    );

    try {
      await axios.patch(
        `${API_URL()}/protected/leads/${leadId}/status`,
        { status: newStatus },
        { headers: authHeaders() }
      );
    } catch {
      toast.error('Falha ao atualizar status. Revertendo...');
      // Revert on error
      setLeads(prev =>
        prev.map(l => {
          if (l.ID === leadId) {
            const original = leads.find(orig => orig.ID === leadId);
            return original ? { ...l, KanbanStatus: original.KanbanStatus } : l;
          }
          return l;
        })
      );
    }
  }, [leads]);

  return { leads, loading, fetchLeads, updateStatus, setLeads };
}
