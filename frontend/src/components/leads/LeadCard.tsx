import React from 'react';
import { Lead } from '@/types';
import { Star, MapPin, Phone, ExternalLink, MessageCircle } from 'lucide-react';

interface LeadCardProps {
  lead: Lead;
  isDragging?: boolean;
  onLeadClick?: (lead: Lead) => void;
}

const LeadCard: React.FC<LeadCardProps> = ({ lead, isDragging, onLeadClick }) => {
  const whatsappUrl = lead.LinkWhatsapp || (lead.Telefone ? `https://wa.me/55${lead.Telefone.replace(/\\D/g, '')}` : null);

  return (
    <div
      onClick={() => onLeadClick?.(lead)}
      className={`relative p-4 rounded-xl bg-glass border border-glass-border shadow-lg backdrop-blur-md transition-all ${onLeadClick ? 'cursor-pointer' : ''} ${
        isDragging ? 'shadow-[0_20px_40px_rgba(0,0,0,0.4)] ring-2 ring-blue-500/50 scale-105 z-50' : 'hover:border-white/20 hover:shadow-xl hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold text-white leading-tight break-words pr-2 line-clamp-2">
          {lead.Empresa || 'Unknown Company'}
        </h4>
        {lead.Rating && (
          <div className="flex items-center gap-1 text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-md text-xs font-medium shrink-0 shadow-[0_0_10px_rgba(250,204,21,0.1)]">
            <Star size={12} className="fill-yellow-400" />
            {lead.Rating.split(' ')[0]} {/* Extract note number if it's mixed with words */}
          </div>
        )}
      </div>
      
      {lead.ResumoNegocio && (
        <p className="text-xs text-gray-400 mb-4 line-clamp-2 leading-relaxed">
          {lead.ResumoNegocio}
        </p>
      )}

      <div className="space-y-2 mb-4">
        {lead.Endereco && (
          <div className="flex items-center gap-2 text-xs text-gray-400 text-left">
            <MapPin size={14} className="shrink-0 text-gray-500" />
            <span className="truncate">{lead.Endereco}</span>
          </div>
        )}
        {lead.Telefone && (
          <div className="flex items-center gap-2 text-xs text-gray-400 text-left">
            <Phone size={14} className="shrink-0 text-gray-500" />
            <span>{lead.Telefone}</span>
            {lead.TipoTelefone && <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-gray-500">{lead.TipoTelefone}</span>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-white/5">
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Chat on WhatsApp"
            className="w-8 h-8 rounded-lg bg-[#25D366]/10 text-[#25D366] flex items-center justify-center hover:bg-[#25D366] flex-none hover:text-white transition-colors cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()} // Prevent drag conflict when clicking link
          >
            <MessageCircle size={16} />
          </a>
        )}
        
        {lead.Site && (
          <a
            href={lead.Site}
            target="_blank"
            rel="noopener noreferrer"
            title="Visit Website"
            className="w-8 h-8 rounded-lg bg-white/5 text-gray-300 flex items-center justify-center hover:bg-white/10 transition-colors flex-none"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ExternalLink size={16} />
          </a>
        )}
        
        <div className="ml-auto text-[10px] text-gray-500 font-medium">
          {lead.QtdAvaliacoes ? `${lead.QtdAvaliacoes.split(' ')[0]} avaliações` : ''}
        </div>
      </div>
    </div>
  );
};

export default LeadCard;
