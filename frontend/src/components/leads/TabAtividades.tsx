import React, { useEffect, useState } from 'react';
import { BusinessEvent } from '@/types';
import { useLeads } from '@/hooks/useLeads';
import { Calendar, Clock, AlertCircle, CheckCircle2, History } from 'lucide-react';
import { motion } from 'framer-motion';

interface TabAtividadesProps {
  leadId: string;
}

const TabAtividades: React.FC<TabAtividadesProps> = ({ leadId }) => {
  const { fetchLeadEvents } = useLeads();
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      const data = await fetchLeadEvents(leadId);
      setEvents(data);
      setLoading(false);
    };
    loadEvents();
  }, [leadId, fetchLeadEvents]);

  const getEventConfig = (type: string, status: string) => {
    if (status === 'CANCELED') {
      return {
        icon: <AlertCircle className="text-red-400" size={18} />,
        bg: 'bg-red-500/10',
        label: 'Cancelado'
      };
    }

    switch (type) {
      case 'MEETING_SCHEDULED':
        return {
          icon: <Calendar className="text-blue-400" size={18} />,
          bg: 'bg-blue-500/10',
          label: 'Agendamento'
        };
      case 'MEETING_REMINDER':
        return {
          icon: <Clock className="text-amber-400" size={18} />,
          bg: 'bg-amber-500/10',
          label: 'Lembrete'
        };
      case 'MEETING_CANCELED':
        return {
          icon: <AlertCircle className="text-red-400" size={18} />,
          bg: 'bg-red-500/10',
          label: 'Cancelamento'
        };
      default:
        return {
          icon: <History className="text-gray-400" size={18} />,
          bg: 'bg-gray-500/10',
          label: 'Atividade'
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] text-gray-500 uppercase tracking-[0.25em] font-black border-l-2 border-blue-500 pl-3">Timeline de Atividades</h3>
        <span className="text-[10px] text-gray-600 font-bold">{events.length} eventos registrados</span>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.01] border border-dashed border-white/5 rounded-3xl">
          <History className="mx-auto mb-4 opacity-10" size={48} />
          <p className="text-gray-500 text-sm font-medium">Nenhuma atividade comercial registrada ainda.</p>
        </div>
      ) : (
        <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-6 before:w-px before:bg-white/5">
          {events.map((event, idx) => {
            const config = getEventConfig(event.type, event.status);
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="relative flex gap-6 group"
              >
                {/* Connector Node */}
                <div className={`w-12 h-12 rounded-2xl ${config.bg} border border-white/5 flex items-center justify-center shrink-0 z-10 transition-transform group-hover:scale-110`}>
                  {config.icon}
                </div>

                {/* Card Content */}
                <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {config.label}
                    </span>
                    <span className="text-[10px] text-gray-600 font-mono">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <p className="text-sm font-bold text-gray-200 mb-1">
                    {event.type === 'MEETING_SCHEDULED' ? '📅 Nova Reunião Agendada' : 
                     event.type === 'MEETING_CANCELED' ? '❌ Reunião Cancelada' :
                     event.type === 'MEETING_REMINDER' ? '🔔 Lembrete de Reunião' : 'Atividade'}
                  </p>

                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                    <div className="text-[10px] text-gray-500 font-medium">
                      Horário da Reunião: <span className="text-gray-300">{new Date(event.scheduled_at).toLocaleString()}</span>
                    </div>
                    {event.status === 'PENDING' && (
                      <span className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase tracking-tighter">
                        <CheckCircle2 size={10} /> Ativo
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TabAtividades;
