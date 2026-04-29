import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '../utils/cn';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { ColorPicker } from '../components/ColorPicker';
import { tagService } from '../services/api';
import { companyService } from '../services/company';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Tag as TagType, Company } from '../types';
import { ConfirmDialog } from '../utils/sweetalert';

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
    const usageWarning = (tag.usage_count || 0) > 0 
      ? `\nEsta tag está em uso em ${tag.usage_count} conversa(s).` 
      : '';
      
    const result = await ConfirmDialog.fire({
      title: 'Excluir Tag?',
      text: `Deseja remover a tag "${tag.name}"?${usageWarning}`,
      icon: 'warning',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">Tags e Classificação</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Crie etiquetas personalizadas para organizar e priorizar suas conversas.
          </p>
        </div>
        
        {companyId && (
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={fetchTags} disabled={loading} className="rounded-xl h-11 px-5 bg-white dark:bg-gray-800 shadow-sm border-gray-200/60 dark:border-gray-700/60">
              <RefreshCw size={18} className={cn("mr-2", loading ? 'animate-spin' : '')} />
              Sincronizar
            </Button>
            <Button
              onClick={() => { setEditingTag(null); resetForm(); setShowForm(true); }}
              className="rounded-xl h-11 px-6 bg-gradient-to-r from-emerald-500 to-green-600 border-none shadow-lg shadow-emerald-500/20"
            >
              <Plus size={18} className="mr-2" />
              Nova Tag
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
            {isSuperAdmin ? 'Selecione uma unidade de negócio para gerenciar tags.' : 'Aguardando vinculação com uma unidade de negócio...'}
          </p>
        </div>
      ) : (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50/50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Etiqueta</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cor</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Kanban</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Prioridade</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Em Uso</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {tags.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500 italic font-medium">
                      Nenhuma tag configurada. Crie uma para classificar seus leads.
                    </td>
                  </tr>
                ) : loading && tags.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <RefreshCw className="animate-spin text-emerald-500 mx-auto" size={24} />
                    </td>
                  </tr>
                ) : (
                  tags.map((tag) => (
                    <tr key={tag.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span 
                          className="px-3 py-1 rounded-full text-xs font-bold border shadow-sm"
                          style={{ 
                            backgroundColor: `${tag.color}15`, 
                            color: tag.color,
                            borderColor: `${tag.color}40`
                          }}
                        >
                          {tag.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="text-[10px] font-mono text-gray-400 uppercase">{tag.color}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tag.kanban_enabled ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 text-[10px] font-black uppercase">Visível</span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 text-[10px] font-black uppercase">Oculto</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium">
                        {tag.sort_order ?? 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-black text-gray-700 dark:text-gray-300">
                          {tag.usage_count ?? 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openEdit(tag)}
                            className="rounded-lg hover:bg-white dark:hover:bg-gray-700 shadow-sm hover:shadow"
                            aria-label="Editar tag"
                          >
                            <Edit size={14} className="text-emerald-600 dark:text-emerald-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(tag)}
                            className="rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 shadow-sm hover:shadow"
                            aria-label="Excluir tag"
                          >
                            <Trash2 size={14} />
                          </Button>
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
