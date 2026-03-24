import { ArrowRight, Plus as PlusCircle } from 'lucide-react';
import { Lead, AIPipelineStage } from '@/types';

interface TabHistoricoProps {
  lead: Lead;
  stages: AIPipelineStage[];
}

const mockHistory = [
  {
    id: '1',
    type: 'move',
    text: 'Negócio movido para a etapa',
    stage: 'Qualificação',
    date: 'Hoje, 14:32',
  },
  {
    id: '2',
    type: 'move',
    text: 'Negócio movido para a etapa',
    stage: 'Leads',
    date: 'Ontem, 10:15',
  },
  {
    id: '3',
    type: 'create',
    text: 'Você criou este negócio',
    stage: '',
    date: '20/03/2026, 09:00',
  },
];

export default function TabHistorico({ lead, stages }: TabHistoricoProps) {
  const currentStage = stages.find((s) => s.id === lead.KanbanStatus);

  return (
    <div className="p-6">
      {/* Current Stage Badge */}
      <div className="flex items-center gap-2 mb-8 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
        <ArrowRight size={16} className="text-blue-500" />
        <span className="text-sm text-blue-700">
          Etapa atual:{' '}
          <span className="font-bold">{currentStage?.name || 'Desconhecida'}</span>
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" />

        <div className="space-y-6">
          {mockHistory.map((item) => (
            <div key={item.id} className="flex gap-4 items-start relative">
              {/* Dot */}
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                  item.type === 'create'
                    ? 'bg-green-100 border-green-400'
                    : 'bg-blue-100 border-blue-400'
                }`}
              >
                {item.type === 'create' ? (
                  <PlusCircle size={12} className="text-green-600" />
                ) : (
                  <ArrowRight size={12} className="text-blue-600" />
                )}
              </div>

              {/* Content */}
              <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm flex-1">
                <p className="text-sm text-gray-700">
                  {item.text}
                  {item.stage && (
                    <span className="font-semibold text-gray-900"> {item.stage}</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-1">{item.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
