import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, Loader2 } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';

const NICHE_OPTIONS = [
  'Software House',
  'Agência de Marketing',
  'Consultoria Empresarial',
  'Agência de Tráfego Pago',
  'Agência de Design',
  'Contabilidade',
  'Advocacia',
  'Clínica de Saúde',
  'E-commerce',
  'SaaS',
];

const TONE_OPTIONS = [
  'Consultivo e Direto',
  'Agressivo e Urgente',
  'Irreverente e Criativo',
  'Formal e Corporativo',
  'Empático e Educativo',
];

const SettingsPage: React.FC = () => {
  const { settings, loading, saving, fetchSettings, updateSettings } = useSettings();

  const [companyName, setCompanyName] = useState('');
  const [niche, setNiche] = useState('');
  const [mainOffer, setMainOffer] = useState('');
  const [toneOfVoice, setToneOfVoice] = useState('');

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.CompanyName);
      setNiche(settings.Niche);
      setMainOffer(settings.MainOffer);
      setToneOfVoice(settings.ToneOfVoice);
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      CompanyName: companyName,
      Niche: niche,
      MainOffer: mainOffer,
      ToneOfVoice: toneOfVoice,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl">
          <Settings className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configurações da IA</h1>
          <p className="text-sm text-gray-500">
            Configure o contexto da sua empresa para personalizar a análise de IA.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-glass/50 border border-glass-border rounded-2xl p-6 space-y-6 backdrop-blur-sm">
          {/* Company Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Nome da Empresa
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-glass-border rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
              placeholder="Ex: Sherlock Scraper"
            />
          </div>

          {/* Niche */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Nicho de Atuação
            </label>
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-glass-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all appearance-none"
            >
              {NICHE_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="bg-zinc-900">
                  {opt}
                </option>
              ))}
              {niche && !NICHE_OPTIONS.includes(niche) && (
                <option value={niche} className="bg-zinc-900">
                  {niche}
                </option>
              )}
            </select>
            <p className="text-xs text-gray-600">
              Ou digite um valor customizado no campo abaixo:
            </p>
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-glass-border rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
              placeholder="Ou digite um nicho personalizado..."
            />
          </div>

          {/* Main Offer */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Oferta Principal / Solução
            </label>
            <textarea
              value={mainOffer}
              onChange={(e) => setMainOffer(e.target.value)}
              rows={5}
              className="w-full px-4 py-3 bg-black/40 border border-glass-border rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all resize-none"
              placeholder="Descreva detalhadamente o que sua empresa oferece. A IA usará esse texto para gerar pitches, icebreakers e identificar gaps nos leads analisados. Quanto mais específico, melhor será a personalização. Ex: Desenvolvimento de sistemas web e mobile sob medida, com foco em automação de processos e integrações inteligentes."
            />
            <p className="text-xs text-gray-600">
              A IA vai basear os Gaps Críticos, Icebreakers e Pitches exclusivamente neste texto.
            </p>
          </div>

          {/* Tone of Voice */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Tom de Voz
            </label>
            <select
              value={toneOfVoice}
              onChange={(e) => setToneOfVoice(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-glass-border rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all appearance-none"
            >
              {TONE_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="bg-zinc-900">
                  {opt}
                </option>
              ))}
              {toneOfVoice && !TONE_OPTIONS.includes(toneOfVoice) && (
                <option value={toneOfVoice} className="bg-zinc-900">
                  {toneOfVoice}
                </option>
              )}
            </select>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-600/20"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Salvar Configurações
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
};

export default SettingsPage;
