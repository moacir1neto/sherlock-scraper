import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { flowService } from '../services/api';
import { companyService } from '../services/company';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import type { Company } from '../types';

interface FlowItem {
  id: string;
  company_id: string;
  name: string;
  command?: string;
  definition?: unknown;
  created_at?: string;
  updated_at?: string;
}

export function Flows() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [items, setItems] = useState<FlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowCommand, setNewFlowCommand] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FlowItem | null>(null);

  const companyId = isSuperAdmin && selectedCompanyId ? selectedCompanyId : (user?.company_id || '');

  useEffect(() => {
    if (isSuperAdmin) {
      companyService
        .list()
        .then(setCompanies)
        .catch(() => setCompanies([]));
    }
  }, [isSuperAdmin]);

  const fetchList = async () => {
    if (isSuperAdmin && !companyId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await flowService.list(isSuperAdmin ? companyId : undefined);
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao carregar fluxos');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [companyId, isSuperAdmin]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFlowName.trim()) {
      toast.error('Nome do fluxo é obrigatório');
      return;
    }
    const cmd = newFlowCommand.trim().replace(/^\\+/, '');
    if (!cmd) {
      toast.error('Comando é obrigatório (ex: boasvindas)');
      return;
    }
    setCreating(true);
    try {
      const flow = await flowService.create({
        name: newFlowName.trim(),
        command: cmd,
        definition: { properties: {}, sequence: [] },
      });
      setShowCreateModal(false);
      setNewFlowName('');
      setNewFlowCommand('');
      toast.success('Fluxo criado');
      navigate(`/admin/flows/${flow.id}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao criar fluxo');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await flowService.delete(deleteTarget.id);
      toast.success('Fluxo excluído');
      setDeleteTarget(null);
      fetchList();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao excluir');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
        <GitBranch size={28} className="text-primary-600 dark:text-primary-400" />
        Fluxos
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Crie sequências de mensagens (texto, mídia, áudio, atrasos e “digitando”) para automatizar conversas.
      </p>

      {isSuperAdmin && companies.length > 0 && (
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Empresa</label>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
          >
            <option value="">Selecione</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex justify-end mb-4">
        <Button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={!companyId}
          className="flex items-center gap-2"
        >
          <Plus size={18} />
          Criar fluxo
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-primary-600" size={32} />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.length === 0 ? (
              <li className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                Nenhum fluxo. Clique em &quot;Criar fluxo&quot; para começar.
              </li>
            ) : (
              items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/flows/${item.id}`)}
                      className="text-left font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 block truncate"
                    >
                      {item.name}
                    </button>
                    {item.command && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        Comando:{' '}
                        <code className="text-primary-600 dark:text-primary-400">
                          \{item.command.replace(/^\\+/, '')}
                        </code>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/flows/${item.id}`)}
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      title="Editar"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        title="Criar fluxo"
        onClose={() => { setShowCreateModal(false); setNewFlowName(''); setNewFlowCommand(''); }}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do fluxo</label>
            <Input
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              placeholder="Ex: Boas-vindas"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comando (sem a barra invertida)</label>
            <Input
              value={newFlowCommand}
              onChange={(e) => setNewFlowCommand(e.target.value)}
              placeholder="ex: boasvindas"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              No chat use:{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-xs">
                \{newFlowCommand.trim().replace(/^\\+/, '') || 'comando'}
              </kbd>
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Criando…' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        title="Excluir fluxo"
        onClose={() => setDeleteTarget(null)}
        size="sm"
      >
        <div className="space-y-4">
          {deleteTarget && (
            <p className="text-gray-600 dark:text-gray-400">
              Deseja realmente excluir o fluxo <strong>{deleteTarget.name}</strong>? Esta ação não pode ser desfeita.
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteConfirm}>
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
