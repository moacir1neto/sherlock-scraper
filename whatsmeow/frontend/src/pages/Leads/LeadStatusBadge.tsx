import type { KanbanStatus } from '../../types';

const STATUS_CONFIG: Record<KanbanStatus, { label: string; className: string; dot: string }> = {
  prospeccao:       { label: 'Prospecção',       className: 'bg-blue-50   text-blue-700   border border-blue-200   dark:bg-blue-900/30   dark:text-blue-300   dark:border-blue-700',   dot: 'bg-blue-500'   },
  contatado:        { label: 'Contatado',         className: 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700', dot: 'bg-yellow-500' },
  reuniao_agendada: { label: 'Reunião Agendada',  className: 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700', dot: 'bg-purple-500' },
  negociacao:       { label: 'Negociação',        className: 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700', dot: 'bg-orange-500' },
  ganho:            { label: 'Ganho',             className: 'bg-green-50  text-green-700  border border-green-200  dark:bg-green-900/30  dark:text-green-300  dark:border-green-700',  dot: 'bg-green-500'  },
  perdido:          { label: 'Perdido',           className: 'bg-red-50    text-red-700    border border-red-200    dark:bg-red-900/30    dark:text-red-300    dark:border-red-700',    dot: 'bg-red-500'    },
};

interface LeadStatusBadgeProps {
  status: KanbanStatus;
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.prospeccao;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}

export { STATUS_CONFIG };
