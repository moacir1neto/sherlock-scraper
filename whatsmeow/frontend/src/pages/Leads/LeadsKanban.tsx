import { useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  Brain, MapPin, Phone, ExternalLink, MessageCircle,
  Star, GripVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsService } from '../../services/leads';
import { useAIAnalysis } from '../../contexts/AIAnalysisContext';
import type { KanbanStatus, Lead } from '../../types';

// ── Colunas do pipeline ───────────────────────────────────────────────────────

const COLUMNS: { id: KanbanStatus; label: string; color: string; border: string; count_bg: string }[] = [
  {
    id: 'prospeccao',
    label: 'Prospecção',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    count_bg: 'bg-blue-500/15 text-blue-400',
  },
  {
    id: 'contatado',
    label: 'Contatado',
    color: 'text-yellow-400',
    border: 'border-yellow-500/30',
    count_bg: 'bg-yellow-500/15 text-yellow-400',
  },
  {
    id: 'reuniao_agendada',
    label: 'Reunião Agendada',
    color: 'text-purple-400',
    border: 'border-purple-500/30',
    count_bg: 'bg-purple-500/15 text-purple-400',
  },
  {
    id: 'negociacao',
    label: 'Negociação',
    color: 'text-orange-400',
    border: 'border-orange-500/30',
    count_bg: 'bg-orange-500/15 text-orange-400',
  },
  {
    id: 'ganho',
    label: 'Ganho',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    count_bg: 'bg-emerald-500/15 text-emerald-400',
  },
  {
    id: 'perdido',
    label: 'Perdido',
    color: 'text-red-400',
    border: 'border-red-500/30',
    count_bg: 'bg-red-500/15 text-red-400',
  },
];

// ── Card individual ───────────────────────────────────────────────────────────

interface KanbanCardProps {
  lead: Lead;
  index: number;
  isDragging: boolean;
  onClick: (lead: Lead) => void;
}

function KanbanCard({ lead, index, isDragging, onClick }: KanbanCardProps) {
  const { analyzingIds } = useAIAnalysis();
  const isAnalyzing = analyzingIds.has(lead.id);

  const whatsappUrl = lead.phone
    ? `https://wa.me/55${lead.phone.replace(/\D/g, '')}`
    : null;

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          onClick={() => onClick(lead)}
          className={`
            group relative bg-white dark:bg-gray-800 rounded-xl border p-4 shadow-sm
            cursor-pointer select-none transition-all duration-200
            ${snapshot.isDragging
              ? 'border-purple-400 shadow-xl rotate-1 scale-105 ring-2 ring-purple-400/40 z-50'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
            }
            ${isAnalyzing ? 'border-l-2 border-l-purple-500' : ''}
          `}
        >
          {/* Drag handle */}
          <div
            {...provided.dragHandleProps}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={14} className="text-gray-400" />
          </div>

          {/* Header: nome + badge IA */}
          <div className="pr-5 mb-2">
            <div className="flex items-start gap-2 flex-wrap">
              <p className={`text-sm font-semibold text-gray-900 dark:text-white leading-tight ${isAnalyzing ? 'animate-pulse' : ''}`}>
                {lead.name}
              </p>
              {isAnalyzing && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold
                                 bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400 animate-pulse shrink-0">
                  <Brain size={9} />
                  IA
                </span>
              )}
              {!isAnalyzing && lead.ai_analysis && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold
                                 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 shrink-0">
                  <Brain size={9} />
                  IA
                </span>
              )}
            </div>
            {lead.nicho && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 uppercase tracking-wide">
                {lead.nicho}
              </p>
            )}
          </div>

          {/* Rating */}
          {lead.rating > 0 && (
            <div className="flex items-center gap-1 mb-2">
              <Star size={11} className="text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {lead.rating.toFixed(1)}
              </span>
              {lead.reviews > 0 && (
                <span className="text-xs text-gray-400">· {lead.reviews} avaliações</span>
              )}
            </div>
          )}

          {/* Resumo */}
          {lead.resumo && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
              {lead.resumo}
            </p>
          )}

          {/* Endereço */}
          {lead.address && (
            <div className="flex items-start gap-1 mb-1">
              <MapPin size={11} className="text-gray-400 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{lead.address}</p>
            </div>
          )}

          {/* Telefone */}
          {lead.phone && (
            <div className="flex items-center gap-1 mb-3">
              <Phone size={11} className="text-gray-400 shrink-0" />
              <p className="text-xs text-gray-600 dark:text-gray-300">{lead.phone}</p>
              {lead.tipo_telefone && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {lead.tipo_telefone}
                </span>
              )}
            </div>
          )}

          {/* Ações rápidas */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700"
               onClick={(e) => e.stopPropagation()}>
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                           bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400
                           hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
              >
                <MessageCircle size={11} />
                WhatsApp
              </a>
            )}
            {lead.website && (
              <a
                href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                           bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400
                           hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <ExternalLink size={11} />
                Site
              </a>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

// ── Coluna ────────────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  column: typeof COLUMNS[number];
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
}

function KanbanColumn({ column, leads, onCardClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Header da coluna */}
      <div className={`flex items-center justify-between px-3 py-2.5 mb-3 rounded-xl border ${column.border} bg-gray-50 dark:bg-gray-900/50`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider ${column.color}`}>
          {column.label}
        </h3>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${column.count_bg}`}>
          {leads.length}
        </span>
      </div>

      {/* Drop zone */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 flex flex-col gap-3 min-h-[120px] rounded-xl p-2 transition-colors duration-150
              ${snapshot.isDraggingOver
                ? 'bg-purple-50 dark:bg-purple-900/10 ring-2 ring-purple-400/30'
                : 'bg-transparent'
              }
            `}
          >
            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex-1 flex items-center justify-center py-8 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-400 dark:text-gray-600">Arraste leads aqui</p>
              </div>
            )}
            {leads.map((lead, index) => (
              <KanbanCard
                key={lead.id}
                lead={lead}
                index={index}
                isDragging={false}
                onClick={onCardClick}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// ── Board principal ───────────────────────────────────────────────────────────

interface LeadsKanbanProps {
  leads: Lead[];
  onLeadsChange: (leads: Lead[]) => void;
  onCardClick: (lead: Lead) => void;
}

export function LeadsKanban({ leads, onLeadsChange, onCardClick }: LeadsKanbanProps) {
  const [updating, setUpdating] = useState<string | null>(null);

  const getColumnLeads = (status: KanbanStatus) =>
    leads.filter((l) => (l.kanban_status || 'prospeccao') === status);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) return;

    const newStatus = destination.droppableId as KanbanStatus;
    const originalLeads = [...leads];

    // Update otimista — UI responde instantaneamente
    onLeadsChange(
      leads.map((l) => l.id === draggableId ? { ...l, kanban_status: newStatus } : l)
    );

    setUpdating(draggableId);
    try {
      await leadsService.updateStatus(draggableId, newStatus);
    } catch {
      toast.error('Falha ao atualizar status. Revertendo...');
      onLeadsChange(originalLeads);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-6 pt-1 px-1 min-h-[500px]"
           style={{ scrollbarWidth: 'thin' }}>
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            leads={getColumnLeads(col.id)}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      {/* Indicador de salvamento */}
      {updating && (
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 pb-2 animate-pulse">
          Salvando alteração...
        </p>
      )}
    </DragDropContext>
  );
}
