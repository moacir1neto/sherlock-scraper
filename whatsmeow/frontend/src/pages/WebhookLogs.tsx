import { useState, useEffect } from 'react';
import { RefreshCw, Copy, X } from 'lucide-react';
import { Button } from '../components/Button';
import { webhookService } from '../services/api';
import { instanceService } from '../services/api';
import { companyService } from '../services/company';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { WebhookLog } from '../types';
import { Company } from '../types';

function tryPrettyJson(raw: string): string {
  const t = raw.trim();
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }
  return raw;
}

function LogDetailModal({
  log,
  onClose,
  onCopy,
}: {
  log: WebhookLog;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
}) {
  const requestPretty = log.request_body ? tryPrettyJson(log.request_body) : '';
  const responsePretty = log.response_body ? tryPrettyJson(log.response_body) : '';

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-modal-title"
    >
      <div
        className="bg-gray-950 rounded-xl shadow-2xl border border-gray-800 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/80">
          <h2 id="log-modal-title" className="text-sm font-semibold text-gray-200">
            {log.event_type} · {log.instance_id}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {log.request_body && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Request</span>
                <button
                  type="button"
                  onClick={() => onCopy(log.request_body!, 'Request')}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-gray-400 hover:text-emerald-400 hover:bg-gray-800/80 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </button>
              </div>
              <pre className="bg-black text-gray-300 text-xs font-mono rounded-lg p-4 overflow-x-auto overflow-y-auto max-h-64 border border-gray-800 whitespace-pre-wrap break-words">
                {requestPretty}
              </pre>
            </div>
          )}
          {log.response_body && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Response</span>
                <button
                  type="button"
                  onClick={() => onCopy(log.response_body!, 'Response')}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-gray-400 hover:text-emerald-400 hover:bg-gray-800/80 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </button>
              </div>
              <pre className="bg-black text-gray-300 text-xs font-mono rounded-lg p-4 overflow-x-auto overflow-y-auto max-h-64 border border-gray-800 whitespace-pre-wrap break-words">
                {responsePretty}
              </pre>
            </div>
          )}
          {!log.request_body && !log.response_body && (
            <p className="text-sm text-gray-500">Nenhum corpo de request ou response.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const EVENT_TYPES = ['message', 'receipt', 'connected', 'disconnected', 'contacts', 'inbox'];

export function WebhookLogs() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [total, setTotal] = useState(0);
  const [instances, setInstances] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('');
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  const fetchInstances = async () => {
    try {
      const data = await instanceService.list();
      const list = Array.isArray(data) ? data : (data as any)?.instances ?? (data as any)?.data ?? [];
      setInstances(
        list.map((item: any) => ({
          id: item.id ?? item.instanceName ?? item.ID,
          instanceName: item.instanceName ?? item.id ?? item.ID,
        }))
      );
    } catch {
      setInstances([]);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      companyService.list().then(setCompanies).catch(() => setCompanies([]));
    }
  }, [isSuperAdmin]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params: any = { limit, offset };
      if (selectedInstanceId) params.instance_id = selectedInstanceId;
      if (isSuperAdmin && selectedCompanyId) params.company_id = selectedCompanyId;
      if (selectedEventType) params.event_type = selectedEventType;
      const res = await webhookService.listLogs(params);
      setLogs(Array.isArray(res.items) ? res.items : []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao carregar logs');
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedInstanceId, selectedCompanyId, selectedEventType, offset]);

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Logs de Webhook</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Histórico de envios e recebimentos (inbox) de webhooks.
      </p>

      <div className="flex flex-wrap gap-4 mb-6">
        {isSuperAdmin && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Empresa
            </label>
            <select
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
            >
              <option value="">Todas</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Instância
          </label>
          <select
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
            value={selectedInstanceId}
            onChange={(e) => setSelectedInstanceId(e.target.value)}
          >
            <option value="">Todas</option>
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.instanceName ?? inst.id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Tipo
          </label>
          <select
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm"
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
          >
            <option value="">Todos</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button variant="secondary" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {loading && logs.length === 0 ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="animate-spin text-primary-600" size={32} />
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Data
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Instância
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Tipo
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  URL
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Erro
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nenhum log encontrado.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                      {log.instance_id}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                      {log.event_type}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={log.url}>
                      {log.url || '-'}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {log.response_status != null ? (
                        <span
                          className={
                            log.response_status >= 200 && log.response_status < 300
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {log.response_status}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-red-600 dark:text-red-400 max-w-[150px] truncate" title={log.error_message}>
                      {log.error_message || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {total > limit && (
        <div className="mt-4 flex justify-between items-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total: {total} registro(s)
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              disabled={offset + limit >= total}
              onClick={() => setOffset((o) => o + limit)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onCopy={async (text, label) => {
            try {
              await navigator.clipboard.writeText(text);
              toast.success(`${label} copiado para a área de transferência`);
            } catch {
              toast.error('Falha ao copiar');
            }
          }}
        />
      )}
    </div>
  );
}
