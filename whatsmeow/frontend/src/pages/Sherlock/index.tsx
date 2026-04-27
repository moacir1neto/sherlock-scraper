import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, Loader2, Plus, Trash2, RefreshCw, ChevronRight,
  CheckCircle, XCircle, Clock, X,
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { sherlockService } from '../../services/sherlock';
import { toast } from 'react-hot-toast';
import type { Scrape } from '../../types';

function StatusBadge({ status }: { status: Scrape['status'] }) {
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

interface NewSearchModalProps {
  onClose: () => void;
  onStarted: (scrape: Scrape) => void;
}

function NewSearchModal({ onClose, onStarted }: NewSearchModalProps) {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !location.trim()) {
      toast.error('Preencha os campos de palavra-chave e localização');
      return;
    }
    setLoading(true);
    try {
      const res = await sherlockService.extract({ 
        keyword: keyword.trim(), 
        location: location.trim(), 
        limit,
        company_id: user?.company_id
      });
      // Monta objeto provisório enquanto o backend processa
      const provisional: Scrape = {
        id: res.data.scrape_id,
        company_id: '',
        user_id: '',
        keyword: keyword.trim(),
        location: location.trim(),
        status: 'running',
        total_leads: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      toast.success('Campanha iniciada! Acompanhe o status na lista.');
      onStarted(provisional);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao iniciar campanha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Search size={20} className="text-primary-600" />
            Nova Prospecção
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Input
            label="Palavra-chave (nicho)"
            placeholder="Ex: Auto Elétrica, Academia, Pizzaria"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={loading}
            required
          />
          <Input
            label="Localização"
            placeholder="Ex: São José, SC"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={loading}
            required
          />
          <Input
            type="number"
            label="Limite de resultados"
            min={1}
            max={100}
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
            disabled={loading}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {loading ? 'Iniciando...' : 'Pesquisar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface SherlockProps {
  onViewLeads: (scrape: Scrape) => void;
}

export function Sherlock({ onViewLeads }: SherlockProps) {
  const [scrapes, setScrapes] = useState<Scrape[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScrapes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await sherlockService.listScrapes();
      setScrapes(res.data.scrapes ?? []);
    } catch {
      if (!silent) toast.error('Falha ao carregar campanhas');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Polling: atualiza campanhas "running" a cada 5s
  useEffect(() => {
    fetchScrapes();

    pollingRef.current = setInterval(async () => {
      setScrapes((prev) => {
        const hasRunning = prev.some((s) => s.status === 'running');
        if (!hasRunning) return prev; // nada para atualizar
        return prev; // mantém e dispara fetch abaixo
      });
      fetchScrapes(true);
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchScrapes]);

  const handleStarted = (scrape: Scrape) => {
    setScrapes((prev) => [scrape, ...prev]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta campanha e todos os seus leads?')) return;
    setDeletingId(id);
    try {
      await sherlockService.deleteScrape(id);
      setScrapes((prev) => prev.filter((s) => s.id !== id));
      toast.success('Campanha removida');
    } catch {
      toast.error('Falha ao remover campanha');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {showModal && (
        <NewSearchModal
          onClose={() => setShowModal(false)}
          onStarted={handleStarted}
        />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Search className="text-primary-600" size={22} />
              Prospecção de Leads
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Cada item é uma campanha de raspagem. Clique em "Ver Leads" para acessar os contatos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => fetchScrapes()} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus size={16} />
              Nova Prospecção
            </Button>
          </div>
        </div>

        {/* Lista de campanhas */}
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
                      Clique em "Nova Prospecção" para começar a capturar leads.
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
                      <StatusBadge status={scrape.status} />
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
                      <div className="flex items-center justify-end gap-2">
                        {scrape.status === 'completed' && scrape.total_leads > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                            onClick={() => onViewLeads(scrape)}
                          >
                            Ver Leads
                            <ChevronRight size={14} />
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={deletingId === scrape.id}
                          onClick={() => handleDelete(scrape.id)}
                        >
                          {deletingId === scrape.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />}
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
    </div>
  );
}
