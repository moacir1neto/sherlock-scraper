import { useState, useEffect } from 'react';
import { Bell, Volume2, Brain, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getNotificationSettings, setNotificationSettings, NotificationSettings } from '../utils/notificationSettings';
import { aiSettingsService } from '../services/ai-settings';
import { Button } from '../components/Button';
import type { AISettingsConfig } from '../types';

// ── Opções dos selects ────────────────────────────────────────────────────────

const NICHO_OPTS = [
  'Software House',
  'Agência de Marketing',
  'Consultoria Empresarial',
  'E-commerce',
  'Clínica / Saúde',
  'Educação / Cursos',
  'Imobiliária',
  'Restaurante / Alimentação',
  'Advocacia',
  'Contabilidade',
  'Outro',
];

const TOM_OPTS = [
  { value: 'Consultivo e Direto', label: 'Consultivo e Direto' },
  { value: 'Amigável e Próximo', label: 'Amigável e Próximo' },
  { value: 'Técnico e Preciso', label: 'Técnico e Preciso' },
  { value: 'Urgente e Persuasivo', label: 'Urgente e Persuasivo' },
  { value: 'Formal e Profissional', label: 'Formal e Profissional' },
];

const DEFAULT_AI: AISettingsConfig = {
  company_name: '',
  nicho: '',
  oferta: '',
  tom_de_voz: '',
};

// ── Seção: Inteligência Artificial ────────────────────────────────────────────

function AISettingsSection() {
  const [form, setForm] = useState<AISettingsConfig>(DEFAULT_AI);
  const [nichoCustom, setNichoCustom] = useState('');
  const [useCustomNicho, setUseCustomNicho] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    aiSettingsService.get()
      .then((res) => {
        const data = res.data;
        setForm(data);
        // Se o nicho não bate com as opções pré-definidas, é customizado
        if (data.nicho && !NICHO_OPTS.includes(data.nicho)) {
          setUseCustomNicho(true);
          setNichoCustom(data.nicho);
        }
      })
      .catch(() => toast.error('Não foi possível carregar as configurações de IA'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      nicho: useCustomNicho ? nichoCustom : form.nicho,
    };
    try {
      await aiSettingsService.save(payload);
      toast.success('Configurações de IA salvas!');
    } catch {
      toast.error('Falha ao salvar configurações de IA');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, children: React.ReactNode, hint?: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{hint}</p>}
    </div>
  );

  const inputCls = `w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2
    bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400
    focus:outline-none focus:ring-2 focus:ring-primary-500 transition`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {field(
        'Nome da Empresa',
        <input
          type="text"
          placeholder="Ex: Sherlock Scraper"
          value={form.company_name}
          onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
          className={inputCls}
        />,
        'Nome usado pela IA para personalizar o pitch e icebreaker.'
      )}

      {field(
        'Nicho de Atuação',
        <div className="space-y-2">
          <select
            value={useCustomNicho ? 'Outro' : form.nicho}
            onChange={(e) => {
              if (e.target.value === 'Outro') {
                setUseCustomNicho(true);
                setForm((f) => ({ ...f, nicho: nichoCustom }));
              } else {
                setUseCustomNicho(false);
                setNichoCustom('');
                setForm((f) => ({ ...f, nicho: e.target.value }));
              }
            }}
            className={inputCls}
          >
            <option value="">Selecione um nicho...</option>
            {NICHO_OPTS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          {useCustomNicho && (
            <input
              type="text"
              placeholder="Digite seu nicho personalizado..."
              value={nichoCustom}
              onChange={(e) => {
                setNichoCustom(e.target.value);
                setForm((f) => ({ ...f, nicho: e.target.value }));
              }}
              className={inputCls}
            />
          )}
        </div>
      )}

      {field(
        'Oferta Principal / Solução',
        <textarea
          rows={4}
          placeholder="Descreva sua oferta principal ou solução. A IA vai basear os Gaps Críticos, Icebreakers e Pitches exclusivamente neste texto."
          value={form.oferta}
          onChange={(e) => setForm((f) => ({ ...f, oferta: e.target.value }))}
          className={`${inputCls} resize-none`}
        />,
        'A IA vai basear os Gaps Críticos, Icebreakers e Pitches exclusivamente neste texto.'
      )}

      {field(
        'Tom de Voz',
        <select
          value={form.tom_de_voz}
          onChange={(e) => setForm((f) => ({ ...f, tom_de_voz: e.target.value }))}
          className={inputCls}
        >
          <option value="">Selecione um tom...</option>
          {TOM_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      <Button type="submit" disabled={saving} className="w-full">
        {saving
          ? <><Loader2 size={16} className="animate-spin" /> Salvando...</>
          : <><Save size={16} /> Salvar Configurações</>
        }
      </Button>
    </form>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function Settings() {
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(
    typeof Notification !== 'undefined' ? Notification.permission : null
  );

  useEffect(() => {
    setNotificationSettings(settings);
  }, [settings]);

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  const sectionCls = 'bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden';
  const headerCls = 'px-6 py-4 border-b border-gray-200 dark:border-gray-700';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Configurações</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Preferências do painel e configurações de inteligência artificial.
        </p>
      </div>

      {/* Seção: Notificações */}
      <div className={sectionCls}>
        <div className={headerCls}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell size={20} className="text-primary-600 dark:text-primary-400" />
            Notificações
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Quando chegar nova mensagem no Chat (incluindo conversas em aguardando).
          </p>
        </div>
        <div className="p-6 space-y-6">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <Bell size={20} className="text-gray-600 dark:text-gray-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Ativar notificações</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Notificação do navegador e indicador na aba quando chegar nova mensagem.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(e) => setSettings((s) => ({ ...s, notificationsEnabled: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <Volume2 size={20} className="text-gray-600 dark:text-gray-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Reproduzir som</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tocar um som ao receber nova mensagem (quando as notificações estiverem ativas).
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => setSettings((s) => ({ ...s, soundEnabled: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              disabled={!settings.notificationsEnabled}
            />
          </label>
          {!settings.notificationsEnabled && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ative as notificações acima para poder usar o som.
            </p>
          )}

          {settings.notificationsEnabled && typeof Notification !== 'undefined' && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Notificações do navegador:{' '}
                {notifPermission === 'granted' ? 'Permitidas' : notifPermission === 'denied' ? 'Bloqueadas' : 'Não solicitadas'}
              </p>
              {notifPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  className="text-sm px-3 py-1.5 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-800/40"
                >
                  {notifPermission === 'default' ? 'Solicitar permissão' : 'Verificar permissão'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Seção: Inteligência Artificial */}
      <div className={sectionCls}>
        <div className={headerCls}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain size={20} className="text-primary-600 dark:text-primary-400" />
            Inteligência Artificial
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure o contexto da sua empresa para personalizar a análise de IA.
          </p>
        </div>
        <div className="p-6">
          <AISettingsSection />
        </div>
      </div>
    </div>
  );
}
