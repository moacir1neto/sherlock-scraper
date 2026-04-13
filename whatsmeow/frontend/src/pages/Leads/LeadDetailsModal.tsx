import { useState, useEffect } from 'react';
import {
  Phone, Globe, MapPin, Mail, Star, MessageCircle, Save,
  Brain, Loader2, ChevronRight, AlertTriangle, Pencil, Check, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../../components/Modal';
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

// ── Aba Dossiê IA ─────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-green-500' :
    score >= 40 ? 'bg-yellow-500' :
    'bg-red-500';
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-500 dark:text-gray-400">Maturidade digital</span>
        <span className="font-bold text-gray-900 dark:text-white">{score}/100</span>
      </div>
      <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

interface DossieTabProps {
  lead: Lead;
  onAnalysisGenerated: (analysis: AIAnalysis) => void;
}

function DossieTab({ lead, onAnalysisGenerated }: DossieTabProps) {
  const [loading, setLoading] = useState(false);
  const [activeSkill, setActiveSkill] = useState<'raiox' | 'email' | 'call'>('raiox');

  // Parse stored analysis
  const stored: AIAnalysis | null = (() => {
    if (!lead.ai_analysis) return null;
    try { return JSON.parse(lead.ai_analysis as string); } catch { return null; }
  })();

  const [analysis, setAnalysis] = useState<AIAnalysis | null>(stored);

  useEffect(() => {
    setAnalysis(stored);
  }, [lead.id]);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="relative">
          <Brain size={48} className="text-primary-500 animate-pulse" />
          <Loader2 size={24} className="absolute -bottom-1 -right-1 text-primary-400 animate-spin" />
        </div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
          Sherlock Neural está pensando...
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-xs">
          Analisando dados do lead e gerando estratégia personalizada
        </p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-5">
        <Brain size={48} className="text-gray-300 dark:text-gray-600" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Dossiê de Inteligência IA
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
            Gere uma análise estratégica personalizada para abordar este lead com mais precisão.
          </p>
        </div>

        {/* Skill selector */}
        <div className="flex gap-2">
          {(['raiox', 'email', 'call'] as const).map((skill) => (
            <button
              key={skill}
              onClick={() => setActiveSkill(skill)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeSkill === skill
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {skill === 'raiox' ? 'Raio-X' : skill === 'email' ? 'E-mail' : 'Ligação'}
            </button>
          ))}
        </div>

        <Button onClick={handleGenerate}>
          <Brain size={16} />
          Gerar Dossiê
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Regenerar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Skill: <span className="font-medium capitalize">{analysis.skill_used}</span>
        </p>
        <div className="flex items-center gap-2">
          {(['raiox', 'email', 'call'] as const).map((skill) => (
            <button
              key={skill}
              onClick={() => setActiveSkill(skill)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                activeSkill === skill
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {skill === 'raiox' ? 'Raio-X' : skill === 'email' ? 'E-mail' : 'Ligação'}
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={handleGenerate}>
            Regerar
          </Button>
        </div>
      </div>

      {/* Score */}
      <ScoreBar score={analysis.score_maturidade} />

      {/* Classificação */}
      <div className="flex items-center gap-2">
        <span className="text-xs px-2.5 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-full font-medium">
          {analysis.classificacao}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {analysis.probabilidade_fechamento}
        </span>
      </div>

      {/* Gap crítico */}
      {analysis.gap_critico && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
          <div>
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-0.5">Gap crítico</p>
            <p className="text-xs text-red-600 dark:text-red-300">{analysis.gap_critico}</p>
          </div>
        </div>
      )}

      {/* Icebreaker WhatsApp */}
      {analysis.icebreaker_whatsapp && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Icebreaker WhatsApp</p>
          <p className="text-xs text-amber-800 dark:text-amber-300 italic">"{analysis.icebreaker_whatsapp}"</p>
        </div>
      )}

      {/* Pitch comercial */}
      {analysis.pitch_comercial && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Pitch Comercial</p>
          <p className="text-xs text-blue-800 dark:text-blue-300">{analysis.pitch_comercial}</p>
        </div>
      )}

      {/* Objeção + Resposta */}
      {analysis.objecao_prevista && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-0.5">Objeção prevista</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{analysis.objecao_prevista}</p>
          </div>
          {analysis.resposta_objecao && (
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-0.5">Como contornar</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">{analysis.resposta_objecao}</p>
            </div>
          )}
        </div>
      )}

      {/* E-mail */}
      {analysis.email_subject && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Assunto do E-mail</p>
          <p className="text-xs text-gray-800 dark:text-gray-200 font-medium">{analysis.email_subject}</p>
          {analysis.email_body && (
            <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans">
              {analysis.email_body}
            </pre>
          )}
        </div>
      )}

      {/* Script de ligação */}
      {analysis.call_script && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Script de Ligação</p>
          <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans">
            {analysis.call_script}
          </pre>
        </div>
      )}

      {/* Próximos passos */}
      {analysis.proximos_passos?.length > 0 && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">Próximos passos</p>
          <ul className="space-y-1">
            {analysis.proximos_passos.map((step, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-green-700 dark:text-green-300">
                <ChevronRight size={12} className="mt-0.5 shrink-0" />
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────

export function LeadDetailsModal({ lead, isOpen, onClose, onUpdated }: LeadDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('info');
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
      // Revalida dados do lead ao abrir o modal para refletir edições externas (ex.: telefone alterado no banco)
      leadsService.getById(lead.id).then((res) => onUpdated(res.data)).catch(() => {/* silencioso — exibe dados já carregados */});
    }
  }, [lead?.id, isOpen]);

  if (!lead) return null;

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      const payload: UpdateLeadRequest = {
        name: lead.name,
        phone: lead.phone,
        address: lead.address,
        website: lead.website,
        email: lead.email,
        kanban_status: kanbanStatus,
        notes,
        estimated_value: lead.estimated_value,
        tags: lead.tags,
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
    if (trimmed === (lead.phone ?? '')) {
      setEditingPhone(false);
      return;
    }
    setSavingPhone(true);
    try {
      const payload: UpdateLeadRequest = {
        name: lead.name,
        phone: trimmed,
        address: lead.address,
        website: lead.website,
        email: lead.email,
        kanban_status: kanbanStatus,
        notes: lead.notes ?? '',
        estimated_value: lead.estimated_value,
        tags: lead.tags,
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={lead.name} size="lg">
      <div>
        {/* Status selector */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Status de prospecção
          </label>
          <select
            value={kanbanStatus}
            onChange={(e) => handleStatusChange(e.target.value as KanbanStatus)}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none
                       focus:ring-2 focus:ring-primary-500"
          >
            {(Object.keys(STATUS_CONFIG) as KanbanStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
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

        {/* Tab: Informações */}
        {activeTab === 'info' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <LeadStatusBadge status={kanbanStatus} />
              {lead.rating > 0 && (
                <span className="flex items-center gap-1 text-sm text-yellow-600">
                  <Star size={14} className="fill-yellow-400 text-yellow-400" />
                  {lead.rating.toFixed(1)}
                  {lead.reviews > 0 && (
                    <span className="text-gray-400">({lead.reviews})</span>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Phone size={16} className="shrink-0 text-gray-400" />
              {editingPhone ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="text"
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSavePhone(); if (e.key === 'Escape') setEditingPhone(false); }}
                    autoFocus
                    className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Ex: 48999999999"
                  />
                  <button
                    onClick={handleSavePhone}
                    disabled={savingPhone}
                    className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                  >
                    {savingPhone ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </button>
                  <button onClick={() => setEditingPhone(false)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <span className={lead.phone ? '' : 'text-gray-400 italic'}>{lead.phone || 'Sem telefone'}</span>
                  <button
                    onClick={() => { setPhoneValue(lead.phone ?? ''); setEditingPhone(true); }}
                    className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Editar telefone"
                  >
                    <Pencil size={13} />
                  </button>
                  {lead.phone && (
                    <a
                      href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                    >
                      <MessageCircle size={14} />
                      WhatsApp
                    </a>
                  )}
                </>
              )}
            </div>

            {lead.email && (
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Mail size={16} className="shrink-0 text-gray-400" />
                <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a>
              </div>
            )}

            {lead.address && (
              <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <MapPin size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <span>{lead.address}</span>
              </div>
            )}

            {lead.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe size={16} className="shrink-0 text-gray-400" />
                <a
                  href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate"
                >
                  {lead.website}
                </a>
              </div>
            )}

            {lead.notes && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Anotações</p>
                <p className="whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Anotações */}
        {activeTab === 'notas' && (
          <div className="space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              placeholder="Adicione observações sobre este lead..."
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <Button onClick={handleSaveNotes} disabled={saving} className="w-full">
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar anotações'}
            </Button>
          </div>
        )}

        {/* Tab: Dossiê IA */}
        {activeTab === 'dossie' && (
          <DossieTab lead={lead} onAnalysisGenerated={handleAnalysisGenerated} />
        )}
      </div>
    </Modal>
  );
}
