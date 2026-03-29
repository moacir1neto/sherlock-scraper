import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Star,
  Phone,
  MessageCircle,
  MapPin,
  Globe,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  ChevronDown,
  ExternalLink,
  Target,
  Maximize2,
  Minimize2,
  Brain,
  Mail,
} from 'lucide-react';
import { Lead, KanbanStatus } from '@/types';
import TabInteligencia from '../pipeline/LeadDetails/TabInteligencia';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface LeadDetailsModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (leadId: string, newStatus: KanbanStatus) => void;
  onUpdateLead: (lead: Lead) => void;
  onAnalyzeLead?: (leadId: string, skill?: string) => Promise<any>;
}

type TabType = 'ia' | 'geral' | 'notas';

// ──────────────────────────────────────────────
// Status Config
// ──────────────────────────────────────────────
const STATUS_CONFIG: Record<KanbanStatus, { label: string; color: string; bg: string; ring: string }> = {
  prospeccao:       { label: 'Prospecção',       color: 'text-blue-400',    bg: 'bg-blue-500/15',    ring: 'ring-blue-500/30' },
  contatado:        { label: 'Contatado',         color: 'text-yellow-400',  bg: 'bg-yellow-500/15',  ring: 'ring-yellow-500/30' },
  reuniao_agendada: { label: 'Reunião Agendada',  color: 'text-purple-400',  bg: 'bg-purple-500/15',  ring: 'ring-purple-500/30' },
  negociacao:       { label: 'Negociação',        color: 'text-orange-400',  bg: 'bg-orange-500/15',  ring: 'ring-orange-500/30' },
  ganho:            { label: 'Ganho',             color: 'text-emerald-400', bg: 'bg-emerald-500/15', ring: 'ring-emerald-500/30' },
  perdido:          { label: 'Perdido',           color: 'text-red-400',     bg: 'bg-red-500/15',     ring: 'ring-red-500/30' },
};
const ALL_STATUSES = Object.keys(STATUS_CONFIG) as KanbanStatus[];

// ──────────────────────────────────────────────
// Star Rating helper
// ──────────────────────────────────────────────
const StarRating = ({ nota }: { nota: string }) => {
  const val = parseFloat(nota);
  if (isNaN(val)) return <span className="text-gray-500 text-sm">Sem avaliação</span>;

  const fullStars = Math.floor(val);
  const hasHalf = val - fullStars >= 0.3;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={16}
            className={
              i < fullStars
                ? 'fill-yellow-400 text-yellow-400'
                : i === fullStars && hasHalf
                ? 'fill-yellow-400/50 text-yellow-400'
                : 'text-gray-600'
            }
          />
        ))}
      </div>
      <span className="text-yellow-400 font-bold text-sm tracking-tight">{val.toFixed(1)}</span>
    </div>
  );
};

// ──────────────────────────────────────────────
// Social icon helper
// ──────────────────────────────────────────────
const SocialLink = ({ href, icon, label, color }: { href: string; icon: React.ReactNode; label: string; color: string }) => {
  if (!href || href === '-') return null;
  return (
    <a
      href={href.startsWith('http') ? href : `https://${href}`}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-90 ${color}`}
    >
      {icon}
    </a>
  );
};

// ──────────────────────────────────────────────
// Main Modal (Slide-over)
// ──────────────────────────────────────────────
const LeadDetailsModal = ({ lead, isOpen, onClose, onStatusChange, onUpdateLead, onAnalyzeLead }: LeadDetailsModalProps) => {
  const [statusOpen, setStatusOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>('ia');

  // Reset tab to IA when lead changes (requested as default)
  useEffect(() => {
    if (lead?.ID) setActiveTab('ia');
  }, [lead?.ID]);

  // Sync notes with lead data
  useEffect(() => {
    if (lead) {
      setNotes(lead.NotasProspeccao || '');
    }
  }, [lead?.ID, lead?.NotasProspeccao]);

  const handleNotesBlur = () => {
    if (lead && notes !== lead.NotasProspeccao) {
      onUpdateLead({ ...lead, NotasProspeccao: notes });
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Close status dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!lead) return null;

  const cfg = STATUS_CONFIG[lead.KanbanStatus] || STATUS_CONFIG.prospeccao;

  const whatsappUrl =
    lead.LinkWhatsapp && lead.LinkWhatsapp !== '-'
      ? lead.LinkWhatsapp
      : lead.Telefone
      ? `https://wa.me/55${lead.Telefone.replace(/\D/g, '')}`
      : null;

  const phoneUrl = lead.Telefone ? `tel:${lead.Telefone.replace(/\s/g, '')}` : null;

  const notaNum = parseFloat(lead.Rating);
  const hasRating = !isNaN(notaNum) && lead.Rating && lead.Rating !== '-';

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
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal panel (Slide-over) */}
          <motion.div
            key="modal"
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed inset-y-0 right-0 z-50 w-full flex pointer-events-none transition-[max-width] duration-300 ease-in-out ${isExpanded ? 'max-w-4xl' : 'max-w-xl'}`}
          >
            <div
              className="w-full bg-[#0a0a0c] border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col h-full pointer-events-auto overflow-hidden relative"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* Background Decoration */}
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-600/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
              
              {/* ── Header ── */}
              <div className="relative px-8 pt-10 pb-2 border-b border-white/5 shrink-0">
                <div className="flex items-start justify-between gap-6 relative">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-5 mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 flex items-center justify-center text-white font-bold text-3xl shrink-0 shadow-[0_8px_30px_rgba(37,99,235,0.4)] border border-white/20">
                        {lead.Empresa?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-2xl font-black text-white leading-tight tracking-tight break-words">
                          {lead.Empresa || 'Empresa sem nome'}
                        </h2>
                        {lead.Nicho && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-400 font-black uppercase tracking-[0.15em]">
                              {lead.Nicho}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="relative" ref={dropdownRef}>
                        <button
                          onClick={() => setStatusOpen((v) => !v)}
                          className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-black border transition-all hover:scale-105 active:scale-95 shadow-lg ${cfg.color} ${cfg.bg} border-current/20`}
                        >
                          <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${cfg.color.replace('text-', 'bg-')}`} />
                          {cfg.label}
                          <ChevronDown size={14} className={`transition-transform duration-500 ${statusOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {statusOpen && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className="absolute top-full left-0 mt-3 z-20 bg-[#121214] border border-white/10 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.7)] py-2 min-w-[220px] backdrop-blur-2xl"
                          >
                            {ALL_STATUSES.map((s) => {
                              const c = STATUS_CONFIG[s];
                              return (
                                <button
                                  key={s}
                                  onClick={() => {
                                    onStatusChange(lead.ID, s);
                                    setStatusOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-3 text-xs text-left hover:bg-white/5 transition-all ${
                                    s === lead.KanbanStatus ? c.color + ' font-black bg-white/5' : 'text-gray-400 hover:text-gray-100'
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${c.color.replace('text-', 'bg-')}`} />
                                  {c.label}
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </div>

                      {hasRating && (
                        <div className="flex items-center gap-2.5 bg-yellow-400/5 border border-yellow-400/20 px-4 py-2 rounded-xl text-yellow-500 shadow-sm backdrop-blur-sm">
                          <StarRating nota={lead.Rating} />
                          {lead.QtdAvaliacoes && lead.QtdAvaliacoes !== '-' && (
                            <span className="text-gray-500 text-[11px] font-bold border-l border-white/10 pl-2.5">
                              {lead.QtdAvaliacoes} avaliações
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 mt-1">
                    <button
                      onClick={() => setIsExpanded((v) => !v)}
                      title={isExpanded ? 'Recolher painel' : 'Expandir painel'}
                      className="p-3 rounded-2xl text-gray-500 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
                    >
                      {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                    </button>
                    <button
                      onClick={onClose}
                      className="p-3 rounded-2xl text-gray-500 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10 group"
                    >
                      <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-1 mt-8 px-1">
                  <button
                    onClick={() => setActiveTab('ia')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                      activeTab === 'ia' 
                        ? 'bg-purple-500/15 text-purple-400 border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]' 
                        : 'text-gray-500 border-transparent hover:text-gray-300'
                    }`}
                  >
                    <Brain size={14} />
                    Inteligência IA
                  </button>
                  <button
                    onClick={() => setActiveTab('geral')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                      activeTab === 'geral' 
                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                        : 'text-gray-500 border-transparent hover:text-gray-300'
                    }`}
                  >
                    <Target size={14} />
                    Geral
                  </button>
                  <button
                    onClick={() => setActiveTab('notas')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                      activeTab === 'notas' 
                        ? 'bg-white/5 text-gray-200 border-white/10' 
                        : 'text-gray-500 border-transparent hover:text-gray-300'
                    }`}
                  >
                    <Mail size={14} />
                    Notas
                  </button>
                </div>
              </div>

              {/* ── Body ── */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                  {activeTab === 'ia' && (
                    <motion.div
                      key="tab-ia"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="h-full"
                    >
                      <TabInteligencia 
                        lead={lead} 
                        onAnalyze={onAnalyzeLead ? (id: string) => onAnalyzeLead(id) : async () => {}}
                      />
                    </motion.div>
                  )}

                  {activeTab === 'geral' && (
                    <motion.div
                      key="tab-geral"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="p-8 space-y-10"
                    >
                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-4">
                        {whatsappUrl && (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex flex-col items-center justify-center gap-3 p-5 bg-[#25D366]/5 hover:bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 rounded-2xl text-sm font-black transition-all hover:-translate-y-1 shadow-sm active:scale-95"
                          >
                            <MessageCircle size={32} className="group-hover:scale-110 transition-transform" />
                            WhatsApp
                          </a>
                        )}
                        {phoneUrl && (
                          <a
                            href={phoneUrl}
                            className="group flex flex-col items-center justify-center gap-3 p-5 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-2xl text-sm font-black transition-all hover:-translate-y-1 shadow-sm active:scale-95"
                          >
                            <Phone size={32} className="group-hover:scale-110 transition-transform" />
                            Ligar
                          </a>
                        )}
                      </div>

                      {/* Main Information Section */}
                      <div className="space-y-6">
                        <h3 className="text-[10px] text-gray-500 uppercase tracking-[0.25em] font-black px-1 border-l-2 border-blue-500 ml-1 pl-3">Informações de Contato</h3>
                        <div className="grid grid-cols-1 gap-4">
                          {lead.Endereco && lead.Endereco !== 'Não encontrado' && (
                            <div className="group flex items-start gap-5 p-6 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl transition-all">
                              <div className="w-12 h-12 rounded-xl bg-gray-500/10 flex items-center justify-center text-gray-400 shrink-0 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-all">
                                <MapPin size={24} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] text-gray-500 uppercase tracking-wider font-black mb-1.5 opacity-60">Endereço Completo</p>
                                <p className="text-sm text-gray-200 leading-relaxed font-semibold">{lead.Endereco}</p>
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.Endereco)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-xs text-blue-400 mt-3 hover:text-blue-300 font-bold transition-colors"
                                >
                                  Ver no Google Maps <ExternalLink size={14} />
                                </a>
                              </div>
                            </div>
                          )}

                          {lead.Telefone && lead.Telefone !== 'Não encontrado' && (
                            <div className="flex items-start gap-5 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                              <div className="w-12 h-12 rounded-xl bg-gray-500/10 flex items-center justify-center text-gray-400 shrink-0">
                                <Phone size={24} />
                              </div>
                              <div>
                                <p className="text-[11px] text-gray-500 uppercase tracking-wider font-black mb-1.5 opacity-60">Telefone Principal</p>
                                <div className="flex items-center gap-3">
                                  <p className="text-xl text-white font-black tracking-tight">{lead.Telefone}</p>
                                  {lead.TipoTelefone && lead.TipoTelefone !== 'Sem número' && (
                                    <span className="px-2.5 py-0.5 text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg font-black uppercase tracking-wider">
                                      {lead.TipoTelefone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Social Links */}
                      {(lead.Instagram || lead.Facebook || lead.LinkedIn || lead.TikTok || lead.YouTube || lead.Site) && (
                        <div className="space-y-6">
                          <h3 className="text-[10px] text-gray-500 uppercase tracking-[0.25em] font-black px-1 border-l-2 border-pink-500 ml-1 pl-3">Presença Digital</h3>
                          <div className="flex items-center gap-4 flex-wrap">
                            <SocialLink href={lead.Instagram} icon={<Instagram size={22} />} label="Instagram" color="bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white shadow-lg shadow-pink-500/10" />
                            <SocialLink href={lead.Facebook} icon={<Facebook size={22} />} label="Facebook" color="bg-[#1877F2] text-white shadow-lg shadow-blue-500/10" />
                            <SocialLink href={lead.LinkedIn} icon={<Linkedin size={22} />} label="LinkedIn" color="bg-[#0A66C2] text-white shadow-lg shadow-blue-600/10" />
                            <SocialLink href={lead.YouTube} icon={<Youtube size={22} />} label="YouTube" color="bg-[#FF0000] text-white shadow-lg shadow-red-500/10" />
                            <SocialLink href={lead.Site} icon={<Globe size={22} />} label="Website" color="bg-white/10 text-white border border-white/10 shadow-lg shadow-white/5" />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'notas' && (
                    <motion.div
                      key="tab-notas"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="p-8 space-y-10"
                    >
                      <div className="space-y-6">
                        <div className="flex items-center justify-between px-1">
                          <h3 className="text-[10px] text-gray-500 uppercase tracking-[0.25em] font-black border-l-2 border-violet-500 pl-3">Notas de Prospecção</h3>
                          <span className="flex items-center gap-2 text-[10px] text-emerald-500/80 font-black uppercase tracking-widest">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Auto-save
                          </span>
                        </div>
                        <div className="relative group">
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/30 to-violet-500/30 rounded-3xl blur opacity-0 group-focus-within:opacity-100 transition duration-700" />
                          <textarea
                            value={notes}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                            onBlur={handleNotesBlur}
                            placeholder="Registre observações estratégicas..."
                            rows={15}
                            className="relative w-full bg-[#0d0d0f] border border-white/10 rounded-3xl px-6 py-5 text-sm text-gray-200 focus:outline-none focus:border-blue-500/40 transition-all custom-scrollbar leading-relaxed"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Footer info */}
              <div className="px-10 py-6 border-t border-white/5 bg-white/[0.01] flex items-center justify-between shrink-0">
                <p className="text-[9px] text-gray-700 font-black uppercase tracking-[0.3em] opacity-50">Sherlock Intelligence System</p>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/40" />
                  <p className="text-[10px] text-gray-700 font-mono tracking-tighter">REF: {lead.ID.substring(0, 8)}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LeadDetailsModal;
