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
  FileText,
  Building2,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { Lead, KanbanStatus } from '@/types';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface LeadDetailsModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (leadId: string, newStatus: KanbanStatus) => void;
  onUpdateLead: (lead: Lead) => void;
}

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
      <span className="text-yellow-400 font-bold text-sm">{val.toFixed(1)}</span>
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
      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 ${color}`}
    >
      {icon}
    </a>
  );
};

// ──────────────────────────────────────────────
// Main Modal
// ──────────────────────────────────────────────
const LeadDetailsModal = ({ lead, isOpen, onClose, onStatusChange, onUpdateLead }: LeadDetailsModalProps) => {
  const [statusOpen, setStatusOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

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
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal panel */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-2xl bg-[#0f0f11] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] pointer-events-auto overflow-hidden"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* ── Header ── */}
              <div className="relative px-6 pt-6 pb-5 border-b border-white/8 shrink-0">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-blue-600/10 blur-[60px] rounded-full pointer-events-none" />

                <div className="flex items-start justify-between gap-4 relative">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg">
                        {lead.Empresa?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold text-white leading-tight truncate">
                          {lead.Empresa || 'Empresa sem nome'}
                        </h2>
                        {lead.Nicho && (
                          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                            {lead.Nicho}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="relative" ref={dropdownRef}>
                        <button
                          onClick={() => setStatusOpen((v) => !v)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 transition-all hover:brightness-125 ${cfg.color} ${cfg.bg} ${cfg.ring}`}
                        >
                          {cfg.label}
                          <ChevronDown size={11} className={`transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {statusOpen && (
                          <div className="absolute top-full left-0 mt-1.5 z-20 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[180px]">
                            {ALL_STATUSES.map((s) => {
                              const c = STATUS_CONFIG[s];
                              return (
                                <button
                                  key={s}
                                  onClick={() => {
                                    onStatusChange(lead.ID, s);
                                    setStatusOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors ${
                                    s === lead.KanbanStatus ? c.color + ' font-semibold' : 'text-gray-300'
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${c.bg.replace('/15', '')}`} />
                                  {c.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {hasRating && (
                        <div className="flex items-center gap-1 bg-yellow-400/10 px-2.5 py-1 rounded-full text-yellow-400">
                          <StarRating nota={lead.Rating} />
                          {lead.QtdAvaliacoes && lead.QtdAvaliacoes !== '-' && (
                            <span className="text-gray-500 text-[11px] ml-1">
                              ({lead.QtdAvaliacoes})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/10 transition-colors shrink-0 mt-1"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* ── Scrollable Body ── */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                    >
                      <MessageCircle size={16} />
                      Abrir WhatsApp
                    </a>
                  )}
                  {phoneUrl && (
                    <a
                      href={phoneUrl}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                    >
                      <Phone size={16} />
                      Ligar
                    </a>
                  )}
                  {lead.Site && lead.Site !== '-' && (
                    <a
                      href={lead.Site.startsWith('http') ? lead.Site : `https://${lead.Site}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                    >
                      <ExternalLink size={16} />
                      Site
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {lead.Endereco && lead.Endereco !== 'Não encontrado' && (
                    <div className="flex items-start gap-3 p-3.5 bg-white/[0.03] border border-white/5 rounded-xl">
                      <MapPin size={16} className="text-gray-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] text-gray-600 uppercase tracking-wider font-semibold mb-0.5">Endereço</p>
                        <p className="text-sm text-gray-200">{lead.Endereco}</p>
                      </div>
                    </div>
                  )}

                  {lead.Telefone && lead.Telefone !== 'Não encontrado' && (
                    <div className="flex items-start gap-3 p-3.5 bg-white/[0.03] border border-white/5 rounded-xl">
                      <Phone size={16} className="text-gray-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] text-gray-600 uppercase tracking-wider font-semibold mb-0.5">Telefone</p>
                        <p className="text-sm text-gray-200">
                          {lead.Telefone}
                          {lead.TipoTelefone && lead.TipoTelefone !== 'Sem número' && (
                            <span className="ml-2 text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-gray-500">
                              {lead.TipoTelefone}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {lead.ResumoNegocio && lead.ResumoNegocio !== '-' && (
                    <div className="flex items-start gap-3 p-3.5 bg-white/[0.03] border border-white/5 rounded-xl">
                      <Building2 size={16} className="text-gray-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] text-gray-600 uppercase tracking-wider font-semibold mb-0.5">Resumo da Empresa</p>
                        <p className="text-sm text-gray-300 leading-relaxed">{lead.ResumoNegocio}</p>
                      </div>
                    </div>
                  )}
                </div>

                {(lead.Instagram || lead.Facebook || lead.LinkedIn || lead.TikTok || lead.YouTube || lead.Site) && (
                  <div>
                    <p className="text-[11px] text-gray-600 uppercase tracking-wider font-semibold mb-2.5">Redes Sociais</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <SocialLink href={lead.Instagram} icon={<Instagram size={16} />} label="Instagram" color="bg-pink-500/10 text-pink-400 hover:bg-pink-500/20" />
                      <SocialLink href={lead.Facebook} icon={<Facebook size={16} />} label="Facebook" color="bg-blue-600/10 text-blue-400 hover:bg-blue-600/20" />
                      <SocialLink href={lead.LinkedIn} icon={<Linkedin size={16} />} label="LinkedIn" color="bg-sky-600/10 text-sky-400 hover:bg-sky-600/20" />
                      <SocialLink href={lead.YouTube} icon={<Youtube size={16} />} label="YouTube" color="bg-red-500/10 text-red-400 hover:bg-red-500/20" />
                      <SocialLink href={lead.Site} icon={<Globe size={16} />} label="Site" color="bg-white/5 text-gray-400 hover:bg-white/10" />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <FileText size={14} className="text-blue-400" />
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                      Notas de Prospecção
                    </p>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                    onBlur={handleNotesBlur}
                    placeholder="Registre observações sobre este lead: histórico de contato, objeções, próximos passos..."
                    rows={4}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all custom-scrollbar"
                  />
                  <p className="text-[10px] text-gray-600 mt-1.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 inline-block" />
                    As notas são salvas ao sair do campo ou fechar o modal.
                  </p>
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
