import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '../utils/cn';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { Company, User } from '../types';
import { companyService } from '../services/company';
import { userService } from '../services/user';
import { api } from '../services/api';

interface Sector {
  id: string;
  company_id: string;
  name: string;
  slug?: string;
  is_default: boolean;
  created_at?: string;
  user_ids?: string[];
}

export function Sectors() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Sector | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [userIds, setUserIds] = useState<string[]>([]);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);

  const companyId = isSuperAdmin && selectedCompanyId ? selectedCompanyId : (user?.company_id || '');

  useEffect(() => {
    if (isSuperAdmin) {
      companyService.list().then(setCompanies).catch(() => setCompanies([]));
    }
  }, [isSuperAdmin]);

  const fetchSectors = async () => {
    if (!companyId) {
      setSectors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await api.get<Sector[]>('/admin/sectors');
      setSectors(Array.isArray(response.data) ? response.data : []);
      if (companyUsers.length === 0) {
        userService.list().then(setCompanyUsers).catch(() => setCompanyUsers([]));
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao carregar setores');
      setSectors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSectors();
  }, [companyId, selectedCompanyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setSaving(true);
    try {
      const payload: { name: string; slug?: string; user_ids?: string[] } = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        user_ids: userIds,
      };
      if (editing) {
        await api.put(`/admin/sectors/${editing.id}`, payload);
        toast.success('Setor atualizado');
      } else {
        await api.post('/admin/sectors', payload);
        toast.success('Setor criado');
      }
      setShowForm(false);
      setEditing(null);
      setName('');
      setSlug('');
      setUserIds([]);
      fetchSectors();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar setor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sector: Sector) => {
    if (sector.is_default) {
      toast.error('Não é possível excluir o setor padrão (Geral)');
      return;
    }
    if (!confirm(`Excluir o setor "${sector.name}"?`)) return;
    try {
      await api.delete(`/admin/sectors/${sector.id}`);
      toast.success('Setor excluído');
      fetchSectors();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao excluir setor');
    }
  };

  const openEdit = (sector: Sector) => {
    setEditing(sector);
    setName(sector.name);
    setSlug(sector.slug || '');
    setUserIds(sector.user_ids || []);
    setShowForm(true);
  };

  useEffect(() => {
    if (companyId && showForm && companyUsers.length === 0) {
      userService.list().then(setCompanyUsers).catch(() => setCompanyUsers([]));
    }
  }, [companyId, showForm]);

  const toggleUser = (userId: string) => {
    setUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">Setores de Atendimento</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Organize seus operadores e atendimentos por departamentos especializados.
          </p>
        </div>
        
        {companyId && (
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={fetchSectors} disabled={loading} className="rounded-xl h-11 px-5 bg-white dark:bg-gray-800 shadow-sm border-gray-200/60 dark:border-gray-700/60">
              <RefreshCw size={18} className={cn("mr-2", loading ? 'animate-spin' : '')} />
              Sincronizar
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setName('');
                setSlug('');
                setUserIds([]);
                setShowForm(true);
              }}
              className="rounded-xl h-11 px-6 bg-gradient-to-r from-emerald-500 to-green-600 border-none shadow-lg shadow-emerald-500/20"
            >
              <Plus size={18} className="mr-2" />
              Novo Setor
            </Button>
          </div>
        )}
      </div>

      {isSuperAdmin && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-4 flex items-center gap-4">
          <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-2">Unidade de Negócio:</label>
          <select
            className="flex-1 max-w-xs rounded-xl border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
          >
            <option value="">Selecione uma empresa</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {!companyId ? (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-12 text-center">
          <p className="text-gray-400 font-medium italic">
            {isSuperAdmin ? 'Selecione uma unidade de negócio para gerenciar seus setores.' : 'Aguardando vinculação com uma unidade de negócio...'}
          </p>
        </div>
      ) : (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50/50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Identificação</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Slug / Rota</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Prioridade</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gerenciar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {sectors.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500 italic font-medium">
                      Nenhum setor configurado para esta unidade.
                    </td>
                  </tr>
                ) : loading && sectors.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <RefreshCw className="animate-spin text-emerald-500 mx-auto" size={24} />
                    </td>
                  </tr>
                ) : (
                  sectors.map((sector) => (
                    <tr key={sector.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                        {sector.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium italic">
                        {sector.slug || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {sector.is_default ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800 text-[10px] font-black uppercase tracking-wider">
                            Padrão
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openEdit(sector)}
                            className="rounded-lg hover:bg-white dark:hover:bg-gray-700 shadow-sm hover:shadow"
                            aria-label="Editar setor"
                          >
                            <Edit size={14} className="text-emerald-600 dark:text-emerald-400" />
                          </Button>
                          {!sector.is_default && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(sector)}
                              className="rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 shadow-sm hover:shadow"
                              aria-label="Excluir setor"
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
          setName('');
          setSlug('');
          setUserIds([]);
        }}
        title={editing ? 'Editar setor' : 'Novo setor'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ex: Suporte, Financeiro"
          />
          <Input
            label="Slug (opcional)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="ex: suporte"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Usuários com acesso ao setor
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Apenas estes usuários poderão ver e atender conversas deste setor.
            </p>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-600 p-2 space-y-1">
              {companyUsers.length === 0 && <p className="text-sm text-gray-500 py-2">Carregando usuários...</p>}
              {companyUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-2 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userIds.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">{u.nome || u.email}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

