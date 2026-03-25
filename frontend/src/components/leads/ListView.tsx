import React, { useState } from 'react';
import { Lead, KanbanStatus, EnrichmentStatus } from '@/types';
import { Star, MapPin, Phone, ExternalLink, MessageCircle, ChevronDown, Loader2, Sparkles, Database } from 'lucide-react';

const STATUS_CONFIG: Record<KanbanStatus, { label: string; color: string; bg: string }> = {
  prospeccao:      { label: 'Prospecção',        color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/30' },
  contatado:       { label: 'Contatado',          color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' },
  reuniao_agendada:{ label: 'Reunião Agendada',   color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30' },
  negociacao:      { label: 'Negociação',         color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30' },
  ganho:           { label: 'Ganho',              color: 'text-emerald-400',bg: 'bg-emerald-500/15 border-emerald-500/30' },
  perdido:         { label: 'Perdido',            color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30' },
};

const ENRICHMENT_CONFIG: Record<EnrichmentStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  CAPTURADO: {
    label: 'Capturado',
    color: 'text-gray-400',
    bg: 'bg-gray-500/15 border-gray-500/30',
    icon: <Database size={11} />
  },
  ENRIQUECENDO: {
    label: 'Enriquecendo',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/15 border-indigo-500/30',
    icon: <Loader2 size={11} className="animate-spin" />
  },
  ENRIQUECIDO: {
    label: 'Enriquecido',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/15 border-cyan-500/30',
    icon: <Sparkles size={11} />
  },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as KanbanStatus[];

interface EnrichmentBadgeProps {
  status: EnrichmentStatus;
  hasPixel?: boolean;
  hasGTM?: boolean;
}

const EnrichmentBadge: React.FC<EnrichmentBadgeProps> = ({ status, hasPixel, hasGTM }) => {
  const cfg = ENRICHMENT_CONFIG[status];

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}
      >
        {cfg.icon}
        {cfg.label}
      </div>
      {status === 'ENRIQUECIDO' && (hasPixel || hasGTM) && (
        <div className="flex items-center gap-1">
          {hasPixel && (
            <div className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30" title="Facebook Pixel detectado">
              FB
            </div>
          )}
          {hasGTM && (
            <div className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30" title="Google Tag Manager detectado">
              GTM
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface StatusBadgeProps {
  status: KanbanStatus;
  onStatusChange: (newStatus: KanbanStatus) => void;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, onStatusChange }) => {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${cfg.bg} ${cfg.color} hover:brightness-125 cursor-pointer`}
      >
        {cfg.label}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[160px]">
            {ALL_STATUSES.map(s => {
              const c = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => { onStatusChange(s); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/5 transition-colors ${s === status ? c.color + ' font-semibold' : 'text-gray-300'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${c.bg.split(' ')[0].replace('/15', '')}`} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

interface ListViewProps {
  leads: Lead[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onStatusChange: (leadId: string, newStatus: KanbanStatus) => void;
  onLeadClick?: (lead: Lead) => void;
}

const ListView: React.FC<ListViewProps> = ({ 
  leads, 
  selectedIds, 
  onSelectionChange, 
  onStatusChange, 
  onLeadClick 
}) => {
  const toggleSelectAll = () => {
    if (selectedIds.length === leads.length && leads.length > 0) {
      onSelectionChange([]);
    } else {
      onSelectionChange(leads.map(l => l.ID));
    }
  };

  const toggleSelectOne = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  if (leads.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-gray-500">
        <p className="text-lg font-medium">Nenhum lead encontrado</p>
        <p className="text-sm mt-1">Inicie uma raspagem para popular a base.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-white/5">
            <th className="py-3 px-4 w-10">
              <input
                type="checkbox"
                className="rounded border-white/10 bg-white/5 text-blue-600 focus:ring-blue-500/20 transition-all cursor-pointer"
                checked={leads.length > 0 && selectedIds.length === leads.length}
                onChange={toggleSelectAll}
                onClick={(e) => e.stopPropagation()}
              />
            </th>
            <th className="text-left py-3 px-4 font-semibold">Empresa</th>
            <th className="text-left py-3 px-4 font-semibold">Enriquecimento</th>
            <th className="text-left py-3 px-4 font-semibold">Status</th>
            <th className="text-left py-3 px-4 font-semibold">Nota</th>
            <th className="text-left py-3 px-4 font-semibold">Endereço</th>
            <th className="text-left py-3 px-4 font-semibold">Telefone</th>
            <th className="text-left py-3 px-4 font-semibold">Resumo</th>
            <th className="text-left py-3 px-4 font-semibold">Links</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, i) => {
            const whatsappUrl = lead.LinkWhatsapp || (lead.Telefone ? `https://wa.me/55${lead.Telefone.replace(/\D/g, '')}` : null);
            const isSelected = selectedIds.includes(lead.ID);
            return (
              <tr
                key={lead.ID}
                onClick={() => onLeadClick?.(lead)}
                className={`border-b border-white/5 hover:bg-white/[0.05] transition-colors ${onLeadClick ? 'cursor-pointer' : ''} ${i % 2 === 0 ? '' : 'bg-white/[0.015]'} ${isSelected ? 'bg-blue-600/10' : ''}`}
              >
                {/* Checkbox */}
                <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="rounded border-white/10 bg-white/5 text-blue-600 focus:ring-blue-500/20 transition-all cursor-pointer"
                    checked={isSelected}
                    onChange={() => {}} // Controlled by onClick on td or row
                    onClick={(e) => toggleSelectOne(e, lead.ID)}
                  />
                </td>

                {/* Empresa */}
                <td className="py-3.5 px-4 w-1/4">
                  <div className="font-medium text-white max-w-[200px] truncate" title={lead.Empresa}>
                    {lead.Empresa || '—'}
                  </div>
                  {lead.Nicho && (
                    <div className="text-[10px] text-gray-500 font-semibold mt-0.5 tracking-wider uppercase">
                      {lead.Nicho}
                    </div>
                  )}
                </td>

                {/* Enrichment Status Badge */}
                <td className="py-3.5 px-4">
                  <EnrichmentBadge
                    status={lead.Status || 'CAPTURADO'}
                    hasPixel={lead.TemPixel}
                    hasGTM={lead.TemGTM}
                  />
                </td>

                {/* Status Badge com Dropdown */}
                <td className="py-3.5 px-4">
                  <StatusBadge
                    status={lead.KanbanStatus}
                    onStatusChange={(newStatus) => onStatusChange(lead.ID, newStatus)}
                  />
                </td>

                {/* Rating */}
                <td className="py-3.5 px-4">
                  {lead.Rating && lead.Rating !== '-' ? (
                    <div className="flex items-center gap-1.5 text-yellow-400">
                      <Star size={12} className="fill-yellow-400 shrink-0" />
                      <span className="text-xs font-bold">{lead.Rating.includes(' ') ? lead.Rating.split(' ')[0] : lead.Rating}</span>
                      {lead.QtdAvaliacoes && lead.QtdAvaliacoes !== '-' && (
                        <span className="text-gray-600 text-[10px] font-medium">({lead.QtdAvaliacoes.includes(' ') ? lead.QtdAvaliacoes.split(' ')[0] : lead.QtdAvaliacoes})</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-700 font-medium">—</span>
                  )}
                </td>

                {/* Endereço */}
                <td className="py-3.5 px-4">
                  {lead.Endereco ? (
                    <div className="flex items-start gap-1.5 text-gray-400 max-w-[220px]">
                      <MapPin size={13} className="shrink-0 mt-0.5 text-gray-600" />
                      <span className="text-xs truncate" title={lead.Endereco}>{lead.Endereco}</span>
                    </div>
                  ) : '—'}
                </td>

                {/* Telefone */}
                <td className="py-3.5 px-4">
                  {lead.Telefone ? (
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Phone size={13} className="shrink-0 text-gray-600" />
                      <span className="text-xs">{lead.Telefone}</span>
                    </div>
                  ) : '—'}
                </td>

                {/* Resumo */}
                <td className="py-3.5 px-4">
                  <p className="text-xs text-gray-500 max-w-[240px] line-clamp-2" title={lead.ResumoNegocio}>
                    {lead.ResumoNegocio || '—'}
                  </p>
                </td>

                {/* Links */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    {whatsappUrl && (
                      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                        className="w-7 h-7 rounded-lg bg-[#25D366]/10 text-[#25D366] flex items-center justify-center hover:bg-[#25D366] hover:text-white transition-colors"
                        title="WhatsApp">
                        <MessageCircle size={14} />
                      </a>
                    )}
                    {lead.Site && (
                      <a href={lead.Site} target="_blank" rel="noopener noreferrer"
                        className="w-7 h-7 rounded-lg bg-white/5 text-gray-400 flex items-center justify-center hover:bg-white/10 transition-colors"
                        title="Site">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ListView;
