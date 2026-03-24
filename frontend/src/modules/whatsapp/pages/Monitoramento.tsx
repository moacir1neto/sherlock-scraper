import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, FileSearch, RefreshCw } from 'lucide-react';
import { incidentService } from '../services/incident';
import { Incident } from '../types';
import { useAuth } from '@/contexts/AuthContext';

export function Monitoramento() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isIncidentes = location.pathname.includes('/incidentes');
  const isAuditoria = location.pathname.includes('/auditoria');

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Monitoramento</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Bem-vindo, {user?.nome}. Área de suporte e investigação.
        </p>
      </div>
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => navigate('/super-admin/monitoramento/incidentes')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              isIncidentes
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <AlertCircle size={18} />
            Incidentes
          </button>
          <button
            onClick={() => navigate('/super-admin/monitoramento/auditoria')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              isAuditoria
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <FileSearch size={18} />
            Auditoria
          </button>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}

export function IncidentesPage() {
  const [items, setItems] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [page, setPage] = useState(0);
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const res = await incidentService.list({ limit, offset: page * limit });
      setItems(res.items || []);
      setTotal(res.total ?? 0);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page]);

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString('pt-BR');
    } catch {
      return s;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Incidentes</h2>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>
      {loading && items.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Código</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mensagem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {items.map((inc) => (
                    <tr
                      key={inc.id}
                      onClick={() => setSelected(inc)}
                      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selected?.id === inc.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatDate(inc.created_at)}</td>
                      <td className="px-3 py-2 text-sm font-mono text-gray-700 dark:text-gray-200">{inc.code}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200 truncate max-w-[200px]">{inc.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > limit && (
              <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                <span>{total} registro(s)</span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-2 py-1 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={(page + 1) * limit >= total}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2 py-1 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            {selected ? (
              <div className="space-y-2 text-sm">
                <p><span className="font-medium text-gray-500 dark:text-gray-400">ID:</span> <span className="font-mono">{selected.id}</span></p>
                <p><span className="font-medium text-gray-500 dark:text-gray-400">Código:</span> {selected.code}</p>
                <p><span className="font-medium text-gray-500 dark:text-gray-400">Mensagem:</span> {selected.message}</p>
                <p><span className="font-medium text-gray-500 dark:text-gray-400">Data:</span> {formatDate(selected.created_at)}</p>
                {selected.instance_id && <p><span className="font-medium text-gray-500 dark:text-gray-400">Instância:</span> {selected.instance_id}</p>}
                {selected.request_path && <p><span className="font-medium text-gray-500 dark:text-gray-400">Path:</span> {selected.request_method} {selected.request_path}</p>}
                {selected.context_type && <p><span className="font-medium text-gray-500 dark:text-gray-400">Contexto:</span> {selected.context_type} {selected.context_id}</p>}
                {selected.user_id && <p><span className="font-medium text-gray-500 dark:text-gray-400">User ID:</span> {selected.user_id}</p>}
                {selected.company_id && <p><span className="font-medium text-gray-500 dark:text-gray-400">Company ID:</span> {selected.company_id}</p>}
                {selected.error_detail && (
                  <div>
                    <p className="font-medium text-gray-500 dark:text-gray-400">Detalhe do erro:</p>
                    <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto whitespace-pre-wrap">{selected.error_detail}</pre>
                  </div>
                )}
                {selected.payload_json && (
                  <div>
                    <p className="font-medium text-gray-500 dark:text-gray-400">Payload:</p>
                    <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto whitespace-pre-wrap">{selected.payload_json}</pre>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">Selecione um incidente na lista.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AuditoriaPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<any | null>(null);
  const limit = 20;
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [companyId, setCompanyId] = useState('');
  const [companies, setCompanies] = useState<Array<{ id: string; nome: string }>>([]);

  useEffect(() => {
    if (isSuperAdmin) {
      import('../services/company').then(({ companyService }) => {
        companyService.list().then((list: any) => {
          const arr = Array.isArray(list) ? list : [];
          setCompanies(arr.map((c: any) => ({ id: c.id, nome: c.nome || c.nome })));
        }).catch(() => setCompanies([]));
      });
    }
  }, [isSuperAdmin]);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { limit, offset: page * limit };
      if (isSuperAdmin && companyId) params.company_id = companyId;
      const res = await import('../services/api').then((m) => m.auditService.list(params));
      setItems(res.items || []);
      setTotal(res.total ?? 0);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, companyId]);

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString('pt-BR');
    } catch {
      return s;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Auditoria</h2>
        {isSuperAdmin && companies.length > 0 && (
          <select
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-1.5 text-sm"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">Todas as empresas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        )}
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>
      {loading && items.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ação</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Entidade</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Usuário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {items.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelected(log)}
                      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selected?.id === log.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="px-3 py-2 text-sm font-mono text-gray-700 dark:text-gray-200">{log.action}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200">{log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">{log.user_email || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > limit && (
              <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                <span>{total} registro(s)</span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-2 py-1 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={(page + 1) * limit >= total}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2 py-1 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            {selected ? (
              <div className="space-y-2 text-sm">
                <p><span className="font-medium text-gray-500 dark:text-gray-400">ID:</span> <span className="font-mono">{selected.id}</span></p>
                <p><span className="font-medium text-gray-500 dark:text-gray-400">Data:</span> {formatDate(selected.created_at)}</p>
                <p><span className="font-medium text-gray-500 dark:text-gray-400">Ação:</span> {selected.action}</p>
                <p><span className="font-medium text-gray-500 dark:text-gray-400">Entidade:</span> {selected.entity_type} {selected.entity_id || ''}</p>
                <p><span className="font-medium text-gray-500 dark:text-gray-400">Usuário:</span> {selected.user_email || '-'}</p>
                {selected.company_id && <p><span className="font-medium text-gray-500 dark:text-gray-400">Empresa ID:</span> {selected.company_id}</p>}
                {selected.old_value && (
                  <div>
                    <p className="font-medium text-gray-500 dark:text-gray-400">Valor anterior:</p>
                    <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto whitespace-pre-wrap">{selected.old_value}</pre>
                  </div>
                )}
                {selected.new_value && (
                  <div>
                    <p className="font-medium text-gray-500 dark:text-gray-400">Novo valor:</p>
                    <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto whitespace-pre-wrap">{selected.new_value}</pre>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">Selecione um registro na lista. A auditoria registra ações no sistema (login, alterações em usuários, empresas, etc.).</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
