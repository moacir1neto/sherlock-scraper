import type { KanbanStatus } from '../../types';

const STATUS_CONFIG: Record<KanbanStatus, { label: string; className: string }> = {
  prospeccao: {
    label: 'Prospecção',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  contatado: {
    label: 'Contatado',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  reuniao_agendada: {
    label: 'Reunião Agendada',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  negociacao: {
    label: 'Negociação',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
  ganho: {
    label: 'Ganho',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  perdido: {
    label: 'Perdido',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
};

interface LeadStatusBadgeProps {
  status: KanbanStatus;
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.prospeccao;
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.className}`}>
      {config.label}
    </span>
  );
}

export { STATUS_CONFIG };
