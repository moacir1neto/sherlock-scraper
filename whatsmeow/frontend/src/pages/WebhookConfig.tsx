import { useState, useEffect } from 'react';
import { RefreshCw, Copy, Send } from 'lucide-react';
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
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Configuração de Webhook
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Configure a URL e os eventos para receber notificações (mensagens, conexão, etc.).
      </p>

      {isSuperAdmin && (
        <div className="space-y-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tenant (empresa)
          </label>
          <select
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2"
            value={selectedCompanyId}
            onChange={(e) => {
              setSelectedCompanyId(e.target.value);
              setSelectedInstanceId('');
            }}
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

      <div className="space-y-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Instância
        </label>
        <select
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2"
          value={selectedInstanceId}
          onChange={(e) => setSelectedInstanceId(e.target.value)}
        >
          <option value="">Selecione</option>
          {filteredInstances.map((inst) => (
            <option key={inst.id ?? inst.instanceName} value={inst.id ?? inst.instanceName}>
              {inst.instanceName ?? inst.id}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          URL do webhook
        </label>
        <Input
          type="url"
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      <div className="space-y-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Secret (opcional, para assinatura HMAC)
        </label>
        <Input
          type="password"
          placeholder="Deixe vazio para não alterar"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
      </div>

      <div className="space-y-2 mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Eventos
        </label>
        <div className="flex flex-wrap gap-3">
          {EVENT_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={events.includes(opt.value)}
                onChange={() => toggleEvent(opt.value)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mb-8">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
        <Button
          variant="secondary"
          onClick={handleSendTest}
          disabled={sendingTest || !url?.trim()}
        >
          <Send className="w-4 h-4 mr-1 inline" />
          {sendingTest ? 'Enviando...' : 'Enviar teste'}
        </Button>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          URL para teste de recebimento
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          Use esta URL no sistema externo para enviar um POST e validar que nosso sistema está
          recebendo. Os recebimentos aparecem nos Logs com tipo &quot;inbox&quot;.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={inboxUrl} className="font-mono text-sm" />
          <Button variant="secondary" onClick={copyInboxUrl} disabled={!inboxUrl}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
