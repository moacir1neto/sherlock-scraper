import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, RefreshCw } from 'lucide-react';
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
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Setores</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Organize atendimentos por setores. O setor Geral é criado automaticamente e não pode ser removido.
      </p>

      {isSuperAdmin && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Empresa</label>
          <select
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
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

      {!companyId && (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
          {isSuperAdmin ? 'Selecione uma empresa para ver e gerenciar setores.' : 'Sua conta não está vinculada a uma empresa.'}
        </p>
      )}

      {companyId && (
        <>
          <div className="flex items-center justify-between mb-4">
            <Button
              onClick={() => {
                setEditing(null);
                setName('');
                setSlug('');
                setUserIds([]);
                setShowForm(true);
              }}
            >
              <Plus size={18} className="mr-2" />
              Novo setor
            </Button>
            <Button variant="secondary" onClick={fetchSectors} disabled={loading}>
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </Button>
          </div>

          {loading && sectors.length === 0 ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="animate-spin text-primary-600" size={32} />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Slug</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Padrão</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {sectors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        Nenhum setor cadastrado.
                      </td>
                    </tr>
                  ) : (
                    sectors.map((sector) => (
                      <tr key={sector.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                          {sector.name}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                          {sector.slug || '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                          {sector.is_default ? (
                            <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs font-semibold">
                              Geral
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(sector)}>
                            <Edit size={16} />
                          </Button>
                          {!sector.is_default && (
                            <Button
                              variant="danger"
                              size="sm"
                              className="ml-1"
                              onClick={() => handleDelete(sector)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
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

