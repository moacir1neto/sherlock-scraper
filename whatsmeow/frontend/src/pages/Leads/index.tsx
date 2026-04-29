import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users, Plus, Trash2, RefreshCw, ChevronLeft, ChevronRight,
  Loader2, Search, CheckCircle, XCircle, Clock, ArrowLeft, Brain,
  LayoutList, Kanban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/Button';
import { leadsService } from '../../services/leads';
import { sherlockService } from '../../services/sherlock';
import type { KanbanStatus, Lead, Scrape } from '../../types';
import { LeadStatusBadge, STATUS_CONFIG } from './LeadStatusBadge';
import { LeadDetailsModal } from './LeadDetailsModal';
import { useAIAnalysis } from '../../contexts/AIAnalysisContext';
import { LeadsKanban } from './LeadsKanban';
import { useLeadsRealtime } from '../../hooks/useLeadsRealtime';
import { BulkSendModal } from './BulkSendModal';
import { ConfirmDialog } from '../../utils/sweetalert';

type ViewMode = 'list' | 'kanban';

// ── StatusBadge para scrapes ─────────────────────────────────────────────────

function ScrapeStatusBadge({ status }: { status: Scrape['status'] }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
        <Loader2 size={12} className="animate-spin" />
        Rodando
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
        <CheckCircle size={12} />
        Concluído
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
      <XCircle size={12} />
      Erro
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Visão 1: Lista de campanhas ───────────────────────────────────────────────

interface CampaignsViewProps {
  onViewLeads: (scrape: Scrape) => void;
}

function CampaignsView({ onViewLeads }: CampaignsViewProps) {
  const navigate = useNavigate();
  const [scrapes, setScrapes] = useState<Scrape[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScrapes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sherlockService.listScrapes();
      setScrapes(res.data.scrapes ?? []);
    } catch {
      toast.error('Falha ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScrapes();
  }, [fetchScrapes]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="text-primary-600" size={22} />
            Leads de Prospecção
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Selecione uma campanha para ver seus leads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchScrapes} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" onClick={() => navigate('/admin/sherlock')}>
            <Plus size={16} />
            Nova Prospecção
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Campanha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Leads</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Data</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading && scrapes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                  Carregando campanhas...
                </td>
              </tr>
            ) : scrapes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <Search size={40} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhuma campanha ainda</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Clique em "Nova Prospecção" para começar.
                  </p>
                </td>
              </tr>
            ) : (
              scrapes.map((scrape) => (
                <tr key={scrape.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                      {scrape.keyword}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock size={11} />
                      {scrape.location}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <ScrapeStatusBadge status={scrape.status} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {scrape.total_leads}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">leads</span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">
                    {formatDate(scrape.created_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {scrape.status === 'completed' && scrape.total_leads > 0 && (
                      <Button
                        size="sm"
                        className="flex items-center gap-1 text-primary-600 dark:text-primary-400"
                        onClick={() => onViewLeads(scrape)}
                      >
                        Ver Leads
                        <ChevronRight size={14} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Badge de status de IA ────────────────────────────────────────────────────

function AIStatusBadge({ hasAnalysis, isAnalyzing }: { hasAnalysis: boolean; isAnalyzing?: boolean }) {
  if (isAnalyzing) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
                       bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400 ml-2 animate-pulse">
        <Loader2 size={11} className="animate-spin" />
        Analisando...
      </span>
    );
  }
  if (!hasAnalysis) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
                     bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 ml-2">
      <Brain size={11} />
      IA
    </span>
  );
}

// ── Visão 2: Leads de uma campanha ────────────────────────────────────────────

interface LeadsViewProps {
  scrape: Scrape;
  onBack: () => void;
}

function LeadsView({ scrape, onBack }: LeadsViewProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analyzingBulk, setAnalyzingBulk] = useState(false);
  const [bulkSendModalOpen, setBulkSendModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');

  const { analyzingIds, startBulkAnalysis, subscribe } = useAIAnalysis();

  const applyLeads = useCallback((all: Lead[]) => {
    const filtered = statusFilter ? all.filter((l) => l.kanban_status === statusFilter) : all;
    setLeads(filtered);
    setTotal(filtered.length);
  }, [statusFilter]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sherlockService.getLeadsByScrape(scrape.id);
      applyLeads(res.data.leads ?? []);
    } catch {
      toast.error('Falha ao carregar leads');
    } finally {
      setLoading(false);
    }
  }, [scrape.id, applyLeads]);

  useEffect(() => {
    fetchLeads();
    setPage(1);
  }, [fetchLeads]);

  // Subscreve no contexto global para receber leads frescos durante o polling
  // (mesmo que o usuário tenha navegado para outro módulo e voltado)
  useEffect(() => {
    const unsub = subscribe(scrape.id, (freshLeads) => {
      setLeads((prev) =>
        prev.map((l) => {
          const updated = freshLeads.find((f) => f.id === l.id);
          return updated ?? l;
        })
      );
    });
    return unsub;
  }, [scrape.id, subscribe]);

  // Revalida lista ao retornar para a aba (ex.: telefone alterado no banco enquanto estava em outra tela)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchLeads();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchLeads]);

  // Reset seleção ao mudar de página ou filtro
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, statusFilter]);

  // Notificações em tempo real: atualiza kanban_status do lead sem re-fetch
  useLeadsRealtime((leadId, newStatus) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, kanban_status: newStatus as Lead['kanban_status'] } : l
      )
    );
  });

  const PAGE_SIZE = 50;
  const visibleLeads = searchQuery.trim()
    ? leads.filter((l) => l.name?.toLowerCase().includes(searchQuery.toLowerCase()) || l.phone?.includes(searchQuery))
    : leads;
  const totalPages = Math.ceil(visibleLeads.length / PAGE_SIZE);
  const paginated = visibleLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allPageSelected = paginated.length > 0 && paginated.every((l) => selectedIds.has(l.id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginated.forEach((l) => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginated.forEach((l) => next.add(l.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    const result = await ConfirmDialog.fire({
      title: 'Remover Lead?',
      text: 'Esta ação não poderá ser desfeita e os dados do lead serão perdidos.',
      icon: 'warning',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;
    setDeletingId(id);
    try {
      await leadsService.delete(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setTotal((prev) => prev - 1);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      toast.success('Lead removido');
    } catch {
      toast.error('Falha ao remover lead');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLeadUpdated = (updated: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    if (selectedLead?.id === updated.id) setSelectedLead(updated);
  };

  const handleAnalyzeBulk = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setAnalyzingBulk(true);
    try {
      await startBulkAnalysis(ids, scrape.id);
      setSelectedIds(new Set());
    } catch {
      toast.error('Falha ao iniciar análise em lote');
    } finally {
      setAnalyzingBulk(false);
    }
  };

  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <ArrowLeft size={16} />
            Campanhas
          </button>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white capitalize">
              {scrape.keyword}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
              <Clock size={11} />
              {scrape.location} · {total} leads
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Busca rápida + filtro de status — só visível na lista */}
          {viewMode === 'list' && (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder="Buscar por nome ou telefone..."
                  aria-label="Buscar leads"
                  className="pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-56
                             focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-gray-400"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
              >
                <option value="">Todos os status</option>
                {(Object.keys(STATUS_CONFIG) as KanbanStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </>
          )}

          <Button variant="ghost" size="sm" onClick={fetchLeads} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </Button>

          {/* Toggle Lista / Kanban */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <LayoutList size={14} />
              Lista
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Kanban size={14} />
              Kanban
            </button>
          </div>
        </div>
      </div>

      {/* Banner de progresso de análise IA em background */}
      {analyzingIds.size > 0 && (
        <div className="px-6 py-3 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800
                        flex items-center gap-3">
          <Loader2 size={15} className="animate-spin text-purple-600 dark:text-purple-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
              IA trabalhando em {analyzingIds.size} lead{analyzingIds.size !== 1 ? 's' : ''}...
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
              Os dossiês serão exibidos automaticamente quando prontos. Pode navegar à vontade.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Kanban ── */}
      {viewMode === 'kanban' && (
        <div className="px-4 pt-4">
          <LeadsKanban
            leads={leads}
            onLeadsChange={setLeads}
            onCardClick={setSelectedLead}
          />
        </div>
      )}

      {/* ── Lista (tabela) ── */}
      {viewMode === 'list' && <><div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Telefone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Endereço</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading && leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                  Carregando leads...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  Nenhum lead encontrado.
                </td>
              </tr>
            ) : (
              paginated.map((lead) => {
                const isAnalyzing = analyzingIds.has(lead.id);
                return (
                <tr
                  key={lead.id}
                  className={`cursor-pointer transition-all duration-300 ${
                    isAnalyzing
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-l-2 border-l-purple-500'
                      : selectedIds.has(lead.id)
                        ? 'bg-purple-50 dark:bg-purple-900/10 hover:bg-purple-100 dark:hover:bg-purple-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  onClick={() => setSelectedLead(lead)}
                >
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      disabled={isAnalyzing}
                      className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500 cursor-pointer disabled:opacity-40"
                    />
                  </td>
                  {/* Nome com avatar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-bold shrink-0"
                        aria-hidden="true"
                      >
                        {lead.name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <p className={`text-sm font-semibold text-gray-900 dark:text-white truncate ${isAnalyzing ? 'animate-pulse' : ''}`}>
                            {lead.name}
                          </p>
                          <AIStatusBadge hasAnalysis={!!lead.ai_analysis} isAnalyzing={isAnalyzing} />
                        </div>
                        {lead.email && <p className="text-xs text-gray-400 truncate">{lead.email}</p>}
                      </div>
                    </div>
                  </td>
                  {/* Telefone clicável */}
                  <td className="px-4 py-3">
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone.replace(/\D/g, '')}`}
                        className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Ligar para ${lead.phone}`}
                      >
                        {lead.phone}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={lead.kanban_status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell max-w-[220px] truncate" title={lead.address ?? undefined}>
                    {lead.address || '—'}
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={deletingId === lead.id || isAnalyzing}
                      onClick={() => handleDelete(lead.id)}
                    >
                      {deletingId === lead.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </Button>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500">
          <span>Página {page} de {totalPages} ({total} leads)</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
      </>}

      <LeadDetailsModal
        lead={selectedLead}
        isOpen={selectedLead !== null}
        onClose={() => setSelectedLead(null)}
        onUpdated={handleLeadUpdated}
      />

      {/* Botão flutuante — seleção pendente ou análise em background (só na lista) */}
      {viewMode === 'list' && (selectedIds.size > 0 || analyzingIds.size > 0) && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
          {analyzingIds.size > 0 && selectedIds.size === 0 ? (
            /* Estado: IA rodando em background, nada selecionado */
            <div className="flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl
                            bg-purple-700 text-white text-sm font-semibold">
              <div className="flex items-center gap-2">
                <Brain size={16} className="animate-pulse" />
                <span>IA analisando {analyzingIds.size} lead{analyzingIds.size !== 1 ? 's' : ''}...</span>
              </div>
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Estado: leads selecionados prontos para disparar */
            <div className="flex bg-purple-600 rounded-full shadow-2xl overflow-hidden divide-x divide-purple-500/50">
              <button
                onClick={handleAnalyzeBulk}
                disabled={analyzingBulk}
                className="flex items-center gap-2.5 px-6 py-3 hover:bg-purple-700 disabled:bg-purple-500 text-white font-semibold text-sm transition-colors"
                title="Gerar Dossiê de IA"
              >
                {analyzingBulk ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
                {analyzingBulk ? 'Iniciando...' : `Dossiê IA (${selectedIds.size})`}
              </button>
              <button
                onClick={() => setBulkSendModalOpen(true)}
                className="flex items-center gap-2.5 px-6 py-3 hover:bg-purple-700 text-white font-semibold text-sm transition-colors"
                title="Disparar WhatsApp em Massa"
              >
                <img src="/whatsapp-logo.svg" alt="WhatsApp" className="w-4 h-4 object-contain brightness-0 invert opacity-90" onError={(e) => e.currentTarget.style.display = 'none'} />
                Disparo ({selectedIds.size})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Disparo */}
      <BulkSendModal
        isOpen={bulkSendModalOpen}
        onClose={() => setBulkSendModalOpen(false)}
        selectedLeads={leads.filter((l) => selectedIds.has(l.id))}
        onStartCampaign={async (instanceId, leadIds) => {
          const res = await leadsService.bulkSend(leadIds, instanceId);
          toast.success(res.data.message || 'Campanha iniciada com sucesso!');
          return res.data.campaign_id;
        }}
      />
    </div>
  );
}

// ── Componente raiz: decide qual visão mostrar ────────────────────────────────

export function Leads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedScrape, setSelectedScrape] = useState<Scrape | null>(null);

  // Suporte a navegação via URL param ?scrape_id=xxx (vindo do Sherlock)
  const scrapeIdParam = searchParams.get('scrape_id');

  useEffect(() => {
    if (scrapeIdParam && !selectedScrape) {
      sherlockService.getScrape(scrapeIdParam)
        .then((res) => setSelectedScrape(res.data))
        .catch(() => {
          toast.error('Campanha não encontrada');
          setSearchParams({}, { replace: true });
        });
    }
  }, [scrapeIdParam]);

  const handleViewLeads = (scrape: Scrape) => {
    setSelectedScrape(scrape);
    setSearchParams({ scrape_id: scrape.id }, { replace: true });
  };

  const handleBack = () => {
    setSelectedScrape(null);
    setSearchParams({}, { replace: true });
  };

  if (selectedScrape) {
    return <LeadsView scrape={selectedScrape} onBack={handleBack} />;
  }

  return <CampaignsView onViewLeads={handleViewLeads} />;
}
