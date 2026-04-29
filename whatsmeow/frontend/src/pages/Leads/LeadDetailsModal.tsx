import { useState, useEffect } from 'react';
import {
  Phone, Globe, MapPin, Mail, Star, MessageCircle, Save,
  Brain, Loader2, ChevronRight, AlertTriangle, Pencil, Check, X,
  Copy, RefreshCw, Maximize2, Minimize2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Button } from '../../components/Button';
import type { AIAnalysis, KanbanStatus, Lead } from '../../types';
import { leadsService, type UpdateLeadRequest } from '../../services/leads';
import { LeadStatusBadge, STATUS_CONFIG } from './LeadStatusBadge';

interface LeadDetailsModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (lead: Lead) => void;
}

type Tab = 'info' | 'notas' | 'dossie';

// ── Gauge circular de maturidade digital ─────────────────────────────────────

function MaturityGauge({ score }: { score: number }) {
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  const label = score >= 70 ? 'Presença sólida' : score >= 40 ? 'Presença moderada' : 'Presença fraca';

  return (
    <div className="flex items-center gap-5 p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl text-white">
      <div className="relative w-20 h-20 shrink-0">
        <svg viewBox="0 0 88 88" className="w-20 h-20 -rotate-90">
          <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
          <circle
            cx="44" cy="44" r={radius} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black leading-none" style={{ color }}>{score}</span>
          <span className="text-[9px] text-slate-400 leading-none">/100</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Maturidade Digital</p>
        <p className="text-base font-bold leading-tight">{label}</p>
        <p className="text-xs text-slate-400 mt-1">
          {score < 40
            ? 'Sem site próprio ou redes ativas — alta receptividade a soluções digitais.'
            : score < 70
            ? 'Presença básica — oportunidade de otimização.'
            : 'Presença estabelecida — foque em diferenciação.'}
        </p>
      </div>
    </div>
  );
}

// ── Botão copiar com feedback ─────────────────────────────────────────────────

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handle}
      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
        copied
          ? 'bg-green-50 text-green-600 border-green-300 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700'
          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600 dark:hover:text-gray-200'
      }`}
      aria-label={`Copiar ${label}`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  );
}

// ── Aba Dossiê IA ─────────────────────────────────────────────────────────────

interface DossieTabProps {
  lead: Lead;
  onAnalysisGenerated: (analysis: AIAnalysis) => void;
  isExpanded: boolean;
}

function DossieTab({ lead, onAnalysisGenerated, isExpanded }: DossieTabProps) {
  const [loading, setLoading] = useState(false);
  const [activeSkill, setActiveSkill] = useState<'raiox' | 'email' | 'call'>('raiox');

  const stored: AIAnalysis | null = (() => {
    if (!lead.ai_analysis) return null;
    try { return JSON.parse(lead.ai_analysis as string); } catch { return null; }
  })();

  const [analysis, setAnalysis] = useState<AIAnalysis | null>(stored);

  useEffect(() => { setAnalysis(stored); }, [lead.id]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await leadsService.analyze(lead.id, activeSkill);
      setAnalysis(res.data);
      onAnalysisGenerated(res.data);
      toast.success('Dossiê gerado com sucesso!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao gerar dossiê');
    } finally {
      setLoading(false);
    }
  };

  // Skill chips compartilhados
  const SkillChips = () => (
    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Selecionar tipo de análise">
      {(['raiox', 'email', 'call'] as const).map((skill) => (
        <button
          key={skill}
          onClick={() => setActiveSkill(skill)}
          aria-pressed={activeSkill === skill}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeSkill === skill
              ? 'bg-primary-600 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {skill === 'raiox' ? 'Raio-X' : skill === 'email' ? 'E-mail' : 'Ligação'}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="relative">
          <Brain size={48} className="text-primary-500 animate-pulse" />
          <Loader2 size={24} className="absolute -bottom-1 -right-1 text-primary-400 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Sherlock Neural está pensando...</p>
        <div className="w-48 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '90%' }}
            transition={{ duration: 6 }}
            className="h-full bg-gradient-to-r from-primary-500 to-emerald-500"
          />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-5">
        <Brain size={48} className="text-gray-300 dark:text-gray-600" />
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Dossiê de Inteligência IA</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
            Gere uma análise estratégica personalizada para abordar este lead com precisão.
          </p>
        </div>
        <SkillChips />
        <Button onClick={handleGenerate}>
          <Brain size={16} />
          Gerar Dossiê
        </Button>
      </div>
    );
  }

  const score = analysis.score_maturidade ?? 0;

  return (
    <div className={`space-y-4 ${isExpanded ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 space-y-0' : ''}`}>
      {/* Header: skill chips + regerar */}
      <div className={`flex items-center justify-between flex-wrap gap-2 ${isExpanded ? 'col-span-full' : ''}`}>
        <SkillChips />
        <button
          onClick={handleGenerate}
          title="Reanalisa o lead com a IA usando os dados mais recentes"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all cursor-pointer"
          aria-label="Regerar análise completa do Dossiê IA"
        >
          <RefreshCw size={12} />
          Regerar
        </button>
      </div>

      {/* Gauge de maturidade */}
      <MaturityGauge score={score} />

      {/* Classificação + prob. fechamento */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2.5 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-full font-semibold">
          {analysis.classificacao}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Prob. fechamento: <span className="font-semibold">{analysis.probabilidade_fechamento}</span>
        </span>
      </div>

      {/* Gap crítico */}
      {analysis.gap_critico && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">Gap Crítico</p>
            </div>
          </div>
          <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{analysis.gap_critico}</p>
        </div>
      )}

      {/* Icebreaker WhatsApp */}
      {analysis.icebreaker_whatsapp && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <MessageCircle size={13} className="text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Icebreaker WhatsApp</p>
            </div>
            <CopyBtn text={analysis.icebreaker_whatsapp} label="Icebreaker" />
          </div>
          <p className="text-xs text-emerald-800 dark:text-emerald-300 italic leading-relaxed">
            "{analysis.icebreaker_whatsapp}"
          </p>
        </div>
      )}

      {/* Pitch comercial */}
      {analysis.pitch_comercial && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Brain size={13} className="text-blue-600 shrink-0" />
              <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Pitch Comercial</p>
            </div>
            <CopyBtn text={analysis.pitch_comercial} label="Pitch" />
          </div>
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">{analysis.pitch_comercial}</p>
        </div>
      )}

      {/* Objeção + Contorno */}
      {analysis.objecao_prevista && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl space-y-3">
          <div>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Objeção prevista</p>
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.objecao_prevista}</p>
          </div>
          {analysis.resposta_objecao && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Como contornar</p>
                <CopyBtn text={analysis.resposta_objecao} label="Script de contorno" />
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.resposta_objecao}</p>
            </div>
          )}
        </div>
      )}

      {/* E-mail */}
      {analysis.email_subject && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Assunto do E-mail</p>
            <CopyBtn text={`${analysis.email_subject}\n\n${analysis.email_body ?? ''}`} label="E-mail" />
          </div>
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{analysis.email_subject}</p>
          {analysis.email_body && (
            <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans leading-relaxed border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
              {analysis.email_body}
            </pre>
          )}
        </div>
      )}

      {/* Script ligação */}
      {analysis.call_script && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Script de Ligação</p>
            <CopyBtn text={analysis.call_script} label="Script" />
          </div>
          <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
            {analysis.call_script}
          </pre>
        </div>
      )}

      {/* Próximos passos */}
      {analysis.proximos_passos?.length > 0 && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide mb-3">Próximos Passos</p>
          <ol className="space-y-2">
            {analysis.proximos_passos.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-xs text-green-800 dark:text-green-300 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ── Drawer principal ──────────────────────────────────────────────────────────

export function LeadDetailsModal({ lead, isOpen, onClose, onUpdated }: LeadDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [isDossierExpanded, setIsDossierExpanded] = useState(false);
  const [notes, setNotes] = useState('');
  const [kanbanStatus, setKanbanStatus] = useState<KanbanStatus>('prospeccao');
  const [saving, setSaving] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    if (isOpen && lead) {
      setNotes(lead.notes ?? '');
      setKanbanStatus(lead.kanban_status);
      setPhoneValue(lead.phone ?? '');
      setEditingPhone(false);
      setActiveTab('info');
      setIsDossierExpanded(false);
      leadsService.getById(lead.id).then((res) => onUpdated(res.data)).catch(() => {});
    }
  }, [lead?.id, isOpen]);

  // Bloqueia scroll do body e fecha com Escape
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', handler);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handler);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  if (!lead) return null;

  const whatsappUrl = lead.phone
    ? `https://wa.me/${lead.phone.replace(/\D/g, '')}`
    : null;

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      const payload: UpdateLeadRequest = {
        name: lead.name, phone: lead.phone, address: lead.address,
        website: lead.website, email: lead.email, kanban_status: kanbanStatus,
        notes, estimated_value: lead.estimated_value, tags: lead.tags,
      };
      const res = await leadsService.update(lead.id, payload);
      onUpdated(res.data);
      toast.success('Lead atualizado');
    } catch {
      toast.error('Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePhone = async () => {
    const trimmed = phoneValue.trim();
    if (trimmed === (lead.phone ?? '')) { setEditingPhone(false); return; }
    setSavingPhone(true);
    try {
      const payload: UpdateLeadRequest = {
        name: lead.name, phone: trimmed, address: lead.address,
        website: lead.website, email: lead.email, kanban_status: kanbanStatus,
        notes: lead.notes ?? '', estimated_value: lead.estimated_value, tags: lead.tags,
      };
      const res = await leadsService.update(lead.id, payload);
      onUpdated(res.data);
      setEditingPhone(false);
      toast.success('Telefone atualizado');
    } catch {
      toast.error('Falha ao salvar telefone');
    } finally {
      setSavingPhone(false);
    }
  };

  const handleStatusChange = async (newStatus: KanbanStatus) => {
    setKanbanStatus(newStatus);
    try {
      await leadsService.updateStatus(lead.id, newStatus);
      onUpdated({ ...lead, kanban_status: newStatus });
      toast.success('Status atualizado');
    } catch {
      toast.error('Falha ao atualizar status');
      setKanbanStatus(lead.kanban_status);
    }
  };

  const handleAnalysisGenerated = (analysis: AIAnalysis) => {
    onUpdated({ ...lead, ai_analysis: JSON.stringify(analysis) });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Informações' },
    { key: 'notas', label: 'Anotações' },
    { key: 'dossie', label: 'Dossiê IA' },
  ];

  const initial = lead.name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.aside
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ 
              x: 0,
              width: isDossierExpanded ? '90vw' : '512px' // 512px é sm:max-w-lg
            }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 bg-white dark:bg-gray-800 shadow-2xl flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalhes do lead ${lead.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header fixo ── */}
            <div className="shrink-0 border-b border-gray-200 dark:border-gray-700 px-5 pt-5 pb-0">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar */}
                  <div
                    className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg shrink-0"
                    aria-hidden="true"
                  >
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-gray-900 dark:text-white text-base leading-tight truncate">
                      {lead.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <LeadStatusBadge status={kanbanStatus} />
                      {lead.rating > 0 && (
                        <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                          <Star size={12} className="fill-yellow-400 text-yellow-400" />
                          {lead.rating.toFixed(1)}
                          {lead.reviews > 0 && (
                            <span className="text-gray-400">({lead.reviews})</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer shrink-0"
                  aria-label="Fechar painel"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex" role="tablist">
                {tabs.map(({ key, label }) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={activeTab === key}
                    aria-controls={`tabpanel-${key}`}
                    onClick={() => {
                      setActiveTab(key);
                      if (key !== 'dossie') setIsDossierExpanded(false);
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                      activeTab === key
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    {key === 'dossie' && <Brain size={13} />}
                    {label}
                  </button>
                ))}
              </div>

              {/* Controles adicionais no header */}
              <div className="absolute top-5 right-14 flex items-center gap-2">
                {activeTab === 'dossie' && (
                  <button
                    onClick={() => setIsDossierExpanded(!isDossierExpanded)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all cursor-pointer"
                    aria-label={isDossierExpanded ? "Recolher dossiê" : "Expandir dossiê"}
                  >
                    {isDossierExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                )}
              </div>
            </div>

            {/* ── Corpo com scroll ── */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                {/* ── Tab: Informações ── */}
                {activeTab === 'info' && (
                  <motion.div
                    key="info"
                    id="tabpanel-info"
                    role="tabpanel"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.18 }}
                    className="p-5 space-y-5"
                  >
                    {/* Banner próximo passo */}
                    {whatsappUrl && (
                      <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                          <MessageCircle size={16} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide mb-0.5">
                            Próximo passo recomendado
                          </p>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400">
                            Envie um icebreaker via WhatsApp para iniciar a conversa.
                          </p>
                        </div>
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                          aria-label="Abrir conversa no WhatsApp"
                        >
                          Abrir
                        </a>
                      </div>
                    )}

                    {/* Seletor de status */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                        Status
                      </label>
                      <select
                        value={kanbanStatus}
                        onChange={(e) => handleStatusChange(e.target.value as KanbanStatus)}
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2
                                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                   focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                      >
                        {(Object.keys(STATUS_CONFIG) as KanbanStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Contato */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contato</h3>

                      {/* Telefone editável */}
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <Phone size={15} className="shrink-0 text-gray-400" />
                        {editingPhone ? (
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="text"
                              value={phoneValue}
                              onChange={(e) => setPhoneValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSavePhone();
                                if (e.key === 'Escape') setEditingPhone(false);
                              }}
                              autoFocus
                              className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5
                                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                         focus:outline-none focus:ring-1 focus:ring-primary-500"
                              placeholder="Ex: 48999999999"
                            />
                            <button onClick={handleSavePhone} disabled={savingPhone} className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50 cursor-pointer">
                              {savingPhone ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            </button>
                            <button onClick={() => setEditingPhone(false)} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className={`text-sm flex-1 ${lead.phone ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 italic'}`}>
                              {lead.phone || 'Sem telefone'}
                            </span>
                            <button
                              onClick={() => { setPhoneValue(lead.phone ?? ''); setEditingPhone(true); }}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                              aria-label="Editar telefone"
                            >
                              <Pencil size={13} />
                            </button>
                            {lead.phone && (
                              <a
                                href={whatsappUrl!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                              >
                                <MessageCircle size={13} />
                                WA
                              </a>
                            )}
                          </>
                        )}
                      </div>

                      {lead.email && (
                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                          <Mail size={15} className="shrink-0 text-gray-400" />
                          <a href={`mailto:${lead.email}`} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
                            {lead.email}
                          </a>
                        </div>
                      )}

                      {lead.address && (
                        <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                          <MapPin size={15} className="mt-0.5 shrink-0 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{lead.address}</p>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary-500 hover:text-primary-700 mt-0.5 inline-block transition-colors"
                            >
                              Ver no Google Maps →
                            </a>
                          </div>
                        </div>
                      )}

                      {lead.website && (
                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                          <Globe size={15} className="shrink-0 text-gray-400" />
                          <a
                            href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-600 dark:text-primary-400 hover:underline truncate"
                          >
                            {lead.website}
                          </a>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ── Tab: Anotações ── */}
                {activeTab === 'notas' && (
                  <motion.div
                    key="notas"
                    id="tabpanel-notas"
                    role="tabpanel"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.18 }}
                    className="p-5 space-y-4"
                  >
                    <label htmlFor="lead-notes" className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Anotações
                    </label>
                    <textarea
                      id="lead-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={8}
                      placeholder="Adicione observações sobre este lead..."
                      aria-label="Anotações sobre o lead"
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    />
                    <Button onClick={handleSaveNotes} disabled={saving} className="w-full">
                      <Save size={16} />
                      {saving ? 'Salvando...' : 'Salvar anotações'}
                    </Button>
                  </motion.div>
                )}

                {/* ── Tab: Dossiê IA ── */}
                {activeTab === 'dossie' && (
                  <motion.div
                    key="dossie"
                    id="tabpanel-dossie"
                    role="tabpanel"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.18 }}
                    className="p-5"
                  >
                    <DossieTab lead={lead} onAnalysisGenerated={handleAnalysisGenerated} isExpanded={isDossierExpanded} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Footer ── */}
            <div className="shrink-0 px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <p className="text-[10px] text-gray-400 font-mono">REF: {lead.id.substring(0, 8)}</p>
              <ChevronRight size={14} className="text-gray-300" />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
