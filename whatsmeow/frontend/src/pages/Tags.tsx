import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { ColorPicker } from '../components/ColorPicker';
import { tagService } from '../services/api';
import { companyService } from '../services/company';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Tag as TagType, Company } from '../types';

export function Tags() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [tags, setTags] = useState<(TagType & { usage_count?: number })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<(TagType & { usage_count?: number }) | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [kanbanEnabled, setKanbanEnabled] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  const companyId = isSuperAdmin && selectedCompanyId ? selectedCompanyId : (user?.company_id || '');

  useEffect(() => {
    if (isSuperAdmin) {
      companyService.list().then(setCompanies).catch(() => setCompanies([]));
    }
  }, [isSuperAdmin]);

  const fetchTags = async () => {
    if (!companyId) {
      setTags([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await tagService.list(isSuperAdmin ? selectedCompanyId : undefined);
      setTags(Array.isArray(list) ? list : []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao carregar tags');
      setTags([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [companyId, selectedCompanyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        color: color.trim() || undefined,
        kanban_enabled: kanbanEnabled,
        sort_order: sortOrder,
      };
      if (editingTag) {
        await tagService.update(editingTag.id, payload);
        toast.success('Tag atualizada');
      } else {
        await tagService.create(payload);
        toast.success('Tag criada');
      }
      setShowForm(false);
      setEditingTag(null);
      resetForm();
      fetchTags();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setColor('#3B82F6');
    setKanbanEnabled(false);
    setSortOrder(0);
  };

  const handleDelete = async (tag: TagType & { usage_count?: number }) => {
    if (!confirm(`Excluir a tag "${tag.name}"?${(tag.usage_count || 0) > 0 ? ` Ela está em uso em ${tag.usage_count} conversa(s).` : ''}`)) return;
    try {
      await tagService.delete(tag.id);
      toast.success('Tag excluída');
      fetchTags();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao excluir');
    }
  };

  const openEdit = (tag: TagType & { usage_count?: number }) => {
    setEditingTag(tag);
    setName(tag.name);
    setColor(tag.color && /^#[0-9A-Fa-f]{6}$/.test(tag.color) ? tag.color : '#3B82F6');
    setKanbanEnabled(tag.kanban_enabled ?? false);
    setSortOrder(tag.sort_order ?? 0);
    setShowForm(true);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Tags</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Crie e gerencie tags por empresa. Use-as no Chat para organizar conversas.
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
          {isSuperAdmin ? 'Selecione uma empresa para ver e gerenciar tags.' : 'Sua conta não está vinculada a uma empresa.'}
        </p>
      )}

      {companyId && (
        <>
          <div className="flex items-center justify-between mb-4">
            <Button onClick={() => { setEditingTag(null); resetForm(); setShowForm(true); }}>
              <Plus size={18} className="mr-2" />
              Nova tag
            </Button>
            <Button variant="secondary" onClick={fetchTags} disabled={loading}>
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </Button>
          </div>

          {loading && tags.length === 0 ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="animate-spin text-primary-600" size={32} />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nome</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cor</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kanban</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ordem</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Em uso</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {tags.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        Nenhuma tag. Crie uma para usar no Chat.
                      </td>
                    </tr>
                  ) : (
                    tags.map((tag) => (
                      <tr key={tag.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">{tag.name}</td>
                        <td className="px-4 py-2">
                          {tag.color ? (
                            <span
                              className="inline-block w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                              style={{ backgroundColor: tag.color }}
                              title={tag.color}
                            />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                          {tag.kanban_enabled ? 'Sim' : 'Não'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{tag.sort_order ?? 0}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{tag.usage_count ?? 0}</td>
                        <td className="px-4 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(tag)}>
                            <Edit size={16} />
                          </Button>
                          <Button variant="danger" size="sm" className="ml-1" onClick={() => handleDelete(tag)}>
                            <Trash2 size={16} />
                          </Button>
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
        onClose={() => { setShowForm(false); setEditingTag(null); resetForm(); }}
        title={editingTag ? 'Editar tag' : 'Nova tag'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ex: Vip, Suporte"
          />
          <ColorPicker value={color} onChange={setColor} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={kanbanEnabled}
              onChange={(e) => setKanbanEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Exibir no Kanban</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ordem</label>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Menor número aparece primeiro na lista e no Kanban.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : editingTag ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
