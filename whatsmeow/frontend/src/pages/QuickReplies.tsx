import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { quickRepliesService } from '../services/api';
import { companyService } from '../services/company';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Company } from '../types';

interface QuickReplyItem {
  id: string;
  company_id: string;
  command: string;
  message: string;
  created_at?: string;
}

export function QuickReplies() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [items, setItems] = useState<QuickReplyItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<QuickReplyItem | null>(null);
  const [command, setCommand] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuickReplyItem | null>(null);

  const companyId = isSuperAdmin && selectedCompanyId ? selectedCompanyId : (user?.company_id || '');

  useEffect(() => {
    if (isSuperAdmin) {
      companyService.list().then(setCompanies).catch(() => setCompanies([]));
    }
  }, [isSuperAdmin]);

  const fetchList = async () => {
    if (!companyId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await quickRepliesService.list(isSuperAdmin ? selectedCompanyId : undefined);
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao carregar respostas rápidas');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [companyId, selectedCompanyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = command.trim().replace(/^\//, '') || command.trim();
    if (!cmd) {
      toast.error('Comando é obrigatório (ex: ola)');
      return;
    }
    if (!message.trim()) {
      toast.error('Mensagem é obrigatória');
      return;
    }
    setSaving(true);
    try {
      const payload = { command: cmd, message: message.trim() };
      if (editing) {
        await quickRepliesService.update(editing.id, payload);
        toast.success('Resposta rápida atualizada');
      } else {
        await quickRepliesService.create(payload);
        toast.success('Resposta rápida criada');
      }
      setShowForm(false);
      setEditing(null);
      setCommand('');
      setMessage('');
      fetchList();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (item: QuickReplyItem) => {
    setDeleteTarget(item);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await quickRepliesService.delete(deleteTarget.id);
      toast.success('Resposta rápida excluída');
      setDeleteTarget(null);
      fetchList();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao excluir');
    }
  };

  const openEdit = (item: QuickReplyItem) => {
    setEditing(item);
    setCommand(item.command);
    setMessage(item.message);
    setShowForm(true);
  };

  const openCreate = () => {
    setEditing(null);
    setCommand('');
    setMessage('');
    setShowForm(true);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
        <MessageSquare size={28} className="text-primary-600 dark:text-primary-400" />
        Respostas Rápidas
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Crie comandos para usar no chat. Digite <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-sm">/comando</kbd> na caixa de mensagem para enviar a mensagem configurada.
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
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex justify-end mb-4">
        <Button
          type="button"
          onClick={openCreate}
          disabled={!companyId}
          className="flex items-center gap-2"
        >
          <Plus size={18} />
          Nova resposta rápida
        </Button>
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : !companyId ? (
        <p className="text-gray-500 dark:text-gray-400">Selecione uma empresa (super admin) ou faça parte de uma empresa.</p>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">Comando</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">Mensagem</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nenhuma resposta rápida. Clique em &quot;Nova resposta rápida&quot; para criar (ex: /ola → &quot;Olá, seja bem-vindo!&quot;).
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <code className="text-primary-600 dark:text-primary-400 font-medium">/{item.command}</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-md truncate" title={item.message}>
                      {item.message}
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(item)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={showForm}
        title={editing ? 'Editar resposta rápida' : 'Nova resposta rápida'}
        onClose={() => { setShowForm(false); setEditing(null); setCommand(''); setMessage(''); }}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comando (sem a barra)</label>
              <Input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="ex: ola"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No chat use: /{command.trim() || 'comando'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensagem</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Olá, seja bem-vindo!"
                rows={4}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {editing ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </form>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        title="Excluir resposta rápida"
        onClose={() => setDeleteTarget(null)}
        size="sm"
      >
        <div className="space-y-4">
          {deleteTarget && (
            <p className="text-gray-600 dark:text-gray-400">
              Deseja realmente excluir o comando <strong>/{deleteTarget.command}</strong>? Esta ação não pode ser desfeita.
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteConfirm}
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
