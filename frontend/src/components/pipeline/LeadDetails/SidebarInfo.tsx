import { useState } from 'react';
import { Mail, Phone, Plus, Building2, User, Search, Loader2 } from 'lucide-react';
import { Lead, AIPipelineStage } from '@/types';

interface SidebarInfoProps {
  lead: Lead;
  stages: AIPipelineStage[];
  onEnrichCNPJ?: (leadId: string) => Promise<any>;
}

export default function SidebarInfo({ lead, stages, onEnrichCNPJ }: SidebarInfoProps) {
  const currentStage = stages.find((s) => s.id === lead.KanbanStatus);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [localCNPJ, setLocalCNPJ] = useState(lead.CNPJ || '');

  const formatBRL = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const initial = lead.Empresa?.charAt(0)?.toUpperCase() || '?';

  const handleEnrichCNPJ = async () => {
    if (!onEnrichCNPJ) return;
    setCnpjLoading(true);
    try {
      const result = await onEnrichCNPJ(lead.ID);
      if (result?.cnpj) {
        setLocalCNPJ(result.cnpj);
      }
    } catch {
      // Error handled by toast in hook
    } finally {
      setCnpjLoading(false);
    }
  };

  const displayCNPJ = localCNPJ || lead.CNPJ;

  return (
    <div className="space-y-5">
      {/* Bloco 1 — Informações do Negócio */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
          Informações do Negócio
        </h3>

        {/* Valor */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Valor</span>
          <span className="text-lg font-bold text-gray-900">
            {formatBRL(lead.estimated_value)}
          </span>
        </div>

        {/* Etapa do Funil */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Etapa do Funil</span>
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: currentStage?.color || '#6b7280' }}
            />
            <span className="text-sm font-semibold text-gray-700">
              {currentStage?.name || 'Sem etapa'}
            </span>
          </div>
        </div>

        {/* Responsável */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Responsável</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
              <User size={12} className="text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">Você</span>
          </div>
        </div>

        {/* Data de Criação */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Criado em</span>
          <span className="text-sm text-gray-700">
            {new Date().toLocaleDateString('pt-BR')}
          </span>
        </div>

        {/* Data Prevista */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Data Prevista</span>
          <span className="text-sm text-gray-700">
            {lead.due_date
              ? new Date(lead.due_date).toLocaleDateString('pt-BR')
              : '—'}
          </span>
        </div>
      </div>

      {/* Bloco 2 — Informações do Contato */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
          Contato
        </h3>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
            {initial}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {lead.Empresa || 'Sem contato'}
            </p>
            <p className="text-xs text-gray-400">{lead.Nicho || 'Sem segmento'}</p>
          </div>
        </div>

        {/* E-mail */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-500">
            <Mail size={14} />
            <span className="text-sm">E-mail</span>
          </div>
          {lead.Email ? (
            <a
              href={`mailto:${lead.Email}`}
              className="text-sm text-blue-600 hover:underline truncate max-w-[180px]"
            >
              {lead.Email}
            </a>
          ) : (
            <button className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
              <Plus size={12} /> Adicionar
            </button>
          )}
        </div>

        {/* Telefone */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-500">
            <Phone size={14} />
            <span className="text-sm">Telefone</span>
          </div>
          {lead.Telefone ? (
            <span className="text-sm text-gray-700">{lead.Telefone}</span>
          ) : (
            <button className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
              <Plus size={12} /> Adicionar
            </button>
          )}
        </div>
      </div>

      {/* Bloco 3 — Informações da Empresa */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
          Empresa
        </h3>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-500">
            <Building2 size={14} />
            <span className="text-sm">Nome Fantasia</span>
          </div>
          <span className="text-sm font-medium text-gray-700">
            {lead.Empresa || '—'}
          </span>
        </div>

        {/* CNPJ with search button */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">CNPJ</span>
          {displayCNPJ ? (
            <span className="text-sm font-mono font-medium text-gray-700">
              {displayCNPJ}
            </span>
          ) : (
            <button
              onClick={handleEnrichCNPJ}
              disabled={cnpjLoading || !onEnrichCNPJ}
              className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {cnpjLoading ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search size={12} />
                  Buscar CNPJ
                </>
              )}
            </button>
          )}
        </div>

        {lead.Site && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Site</span>
            <a
              href={lead.Site}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline truncate max-w-[180px]"
            >
              {lead.Site}
            </a>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Endereço</span>
          <span className="text-sm text-gray-700 text-right max-w-[200px] truncate">
            {lead.Endereco || '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
