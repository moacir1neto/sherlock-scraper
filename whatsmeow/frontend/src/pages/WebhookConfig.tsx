import { useState, useEffect } from 'react';
import { RefreshCw, Copy, Send } from 'lucide-react';
import { cn } from '../utils/cn';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { instanceService } from '../services/api';
import { companyService } from '../services/company';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Company } from '../types';

const EVENT_OPTIONS = [
  { value: 'MESSAGES_UPSERT', label: 'Mensagens' },
  { value: 'MESSAGES_UPDATE', label: 'Recebimentos/leituras' },
  { value: 'CONNECTED', label: 'Conexão' },
  { value: 'DISCONNECTED', label: 'Desconexão' },
];

export function WebhookConfig() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [instances, setInstances] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [base64, setBase64] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL || '/v1';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const data = await instanceService.list();
      const list = Array.isArray(data)
        ? data
        : (data as any)?.instances ?? (data as any)?.data ?? [];
      const normalized = list.map((item: any) => {
        const inst = item.Instance ?? item;
        const id = inst.id ?? inst.ID ?? item.instanceName ?? item.InstanceName;
        return {
          id,
          instanceName: item.InstanceName ?? inst.instanceName ?? id,
          webhook: inst.webhook ?? item.webhook ?? {},
          company_id: inst.company_id ?? inst.companyId,
        };
      });
      setInstances(normalized);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao carregar instâncias');
      setInstances([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      setLoadingCompanies(true);
      companyService
        .list()
        .then(setCompanies)
        .catch(() => toast.error('Erro ao carregar empresas'))
        .finally(() => setLoadingCompanies(false));
    }
  }, [isSuperAdmin]);

  const filteredInstances =
    isSuperAdmin && selectedCompanyId
      ? instances.filter((i: any) => (i.company_id ?? i.companyId) === selectedCompanyId)
      : instances;

  const currentInstance = filteredInstances.find((i) => (i.id ?? i.instanceName) === selectedInstanceId);
  const currentWebhook = currentInstance?.webhook ?? {};

  useEffect(() => {
    if (currentWebhook?.url) setUrl(currentWebhook.url);
    else setUrl('');
    if (currentWebhook?.events?.length) setEvents(currentWebhook.events);
    else setEvents([]);
    setBase64(!!currentWebhook?.base64);
  }, [selectedInstanceId, currentWebhook?.url, currentWebhook?.events, currentWebhook?.base64]);

  const handleSave = async () => {
    if (!selectedInstanceId) {
      toast.error('Selecione uma instância');
      return;
    }
    try {
      setSaving(true);
      await instanceService.updateWebhook(selectedInstanceId, {
        url: url || undefined,
        secret: secret || undefined,
        events,
        base64,
      });
      toast.success('Webhook salvo com sucesso');
      setSecret('');
      fetchInstances();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar webhook');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!selectedInstanceId) {
      toast.error('Selecione uma instância');
      return;
    }
    if (!url?.trim()) {
      toast.error('Configure a URL do webhook antes de enviar o teste');
      return;
    }
    try {
      setSendingTest(true);
      await instanceService.webhookSendTest(selectedInstanceId);
      toast.success('Evento de teste enviado. Verifique os logs de webhook.');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao enviar teste');
    } finally {
      setSendingTest(false);
    }
  };

  const inboxUrl = selectedInstanceId
    ? (apiBase.startsWith('http') ? apiBase : `${origin}${apiBase.replace(/\/$/, '')}`) + `/instance/${selectedInstanceId}/webhook-inbox`
    : '';

  const copyInboxUrl = () => {
    if (!inboxUrl) return;
    navigator.clipboard.writeText(inboxUrl);
    toast.success('URL copiada');
  };

  const toggleEvent = (value: string) => {
    setEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  };

  if (loading && instances.length === 0 && !loadingCompanies) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <RefreshCw className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">Configurações de Webhook</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Mantenha seus sistemas integrados em tempo real através de eventos HTTP.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchInstances} disabled={loading} className="rounded-xl h-11 px-5 bg-white dark:bg-gray-800 shadow-sm border-gray-200/60 dark:border-gray-700/60">
          <RefreshCw size={18} className={cn("mr-2", loading ? 'animate-spin' : '')} />
          Sincronizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg p-6 space-y-6">
            {isSuperAdmin && (
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                  Unidade de Negócio
                </label>
                <select
                  className="w-full rounded-xl border border-gray-200/60 dark:border-gray-700/60 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm text-gray-900 dark:text-white px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer shadow-sm transition-all"
                  value={selectedCompanyId}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    setSelectedInstanceId('');
                  }}
                >
                  <option value="">Todas as empresas</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                Instância de WhatsApp
              </label>
              <select
                className="w-full rounded-xl border border-gray-200/60 dark:border-gray-700/60 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm text-gray-900 dark:text-white px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer shadow-sm transition-all"
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
              >
                <option value="">Selecione uma instância...</option>
                {filteredInstances.map((inst) => (
                  <option key={inst.id ?? inst.instanceName} value={inst.id ?? inst.instanceName}>
                    {inst.instanceName ?? inst.id}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="URL de Destino (Endpoint)"
              type="url"
              placeholder="https://suapi.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />

            <Input
              label="Chave Secreta ( HMAC Secret )"
              type="password"
              placeholder="Deixe vazio para manter a chave atual"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />

            <div className="space-y-3">
              <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                Eventos para Assinatura
              </label>
              <div className="grid grid-cols-2 gap-3">
                {EVENT_OPTIONS.map((opt) => (
                  <label key={opt.value} className="group flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-emerald-800 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={events.includes(opt.value)}
                      onChange={() => toggleEvent(opt.value)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-emerald-600 focus:ring-emerald-500/20"
                    />
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-700/50">
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 border-none shadow-lg shadow-emerald-500/20 h-11"
              >
                {saving ? 'Gravando...' : 'Salvar Configurações'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleSendTest}
                disabled={sendingTest || !url?.trim()}
                className="rounded-xl h-11 px-6 border-gray-200/60 dark:border-gray-700/60"
              >
                <Send className="w-4 h-4 mr-2" />
                {sendingTest ? 'Enviando...' : 'Teste de Envio'}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-4">
              Inbox de Validação
            </h3>
            <p className="text-xs text-emerald-800/70 dark:text-emerald-400/60 leading-relaxed mb-6">
              Utilize esta URL exclusiva para simular recebimentos e validar sua integração. Todos os pacotes capturados ficarão registrados nos logs com a tag <span className="font-bold">INBOX</span>.
            </p>
            
            <div className="space-y-3">
              <label className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest ml-1">
                URL de Simulação
              </label>
              <div className="relative group">
                <input 
                  readOnly 
                  value={inboxUrl || 'Selecione uma instância...'} 
                  className="w-full bg-white/80 dark:bg-gray-900/80 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl px-4 py-3 text-xs font-mono text-emerald-600 dark:text-emerald-400 shadow-inner outline-none"
                />
                <button
                  onClick={copyInboxUrl}
                  disabled={!inboxUrl}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors disabled:opacity-50"
                  aria-label="Copiar URL de Inbox"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
              Dica Técnica
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed italic">
              Certifique-se de que seu endpoint retorna um status HTTP 200 rapidamente. Retentativas automáticas são aplicadas em caso de erro 5xx.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
