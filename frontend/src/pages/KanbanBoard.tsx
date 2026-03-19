import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import toast from 'react-hot-toast';
import { Lead, KanbanStatus } from '@/types';
import LeadCard from '@/components/leads/LeadCard';
import { useLeads } from '@/hooks/useLeads';

const COLUMNS: { id: KanbanStatus; title: string }[] = [
  { id: 'prospeccao', title: 'Prospecção' },
  { id: 'contatado', title: 'Contatado' },
  { id: 'reuniao_agendada', title: 'Reunião Agendada' },
  { id: 'negociacao', title: 'Negociação' },
  { id: 'ganho', title: 'Ganho' },
  { id: 'perdido', title: 'Perdido' },
];

interface KanbanBoardProps {
  leads: Lead[];
  onStatusChange: (leadId: string, newStatus: KanbanStatus) => void;
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ leads, onStatusChange, setLeads }) => {
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId as KanbanStatus;

    // Optimistic update via setLeads (shared state from parent)
    setLeads(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(l => l.ID === draggableId);
      if (idx !== -1) updated[idx] = { ...updated[idx], KanbanStatus: newStatus };
      return updated;
    });

    try {
      await onStatusChange(draggableId, newStatus);
    } catch {
      toast.error('Falha ao atualizar status. Revertendo...');
    }
  };

  return (
    <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex h-full items-start space-x-6 min-w-max pb-4">
          {COLUMNS.map(column => {
            const columnLeads = leads.filter(l => l.KanbanStatus === column.id);

            return (
              <div key={column.id} className="w-[320px] flex flex-col h-full max-h-full">
                <div className="flex items-center justify-between mb-4 px-1 shrink-0">
                  <h3 className="font-semibold text-gray-300 tracking-wider text-sm uppercase">{column.title}</h3>
                  <span className="bg-white/10 text-xs font-semibold px-2.5 py-1 rounded-full">{columnLeads.length}</span>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex-1 overflow-y-auto custom-scrollbar rounded-2xl p-3 border border-transparent transition-colors ${
                        snapshot.isDraggingOver ? 'bg-white/10 border-white/10' : 'bg-black/30'
                      }`}
                    >
                      {columnLeads.map((lead, index) => (
                        <Draggable key={lead.ID} draggableId={lead.ID} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{ ...provided.draggableProps.style }}
                              className={`mb-3 last:mb-0 transform transition-transform ${snapshot.isDragging ? 'rotate-2' : ''}`}
                            >
                              <LeadCard lead={lead} isDragging={snapshot.isDragging} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
};

// Standalone page wrapper (keeps old route /dashboard/kanban working)
const KanbanPage: React.FC = () => {
  const { leads, loading, fetchLeads, updateStatus, setLeads } = useLeads();

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-blue-500 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">Lead Pipeline</h1>
        <p className="text-gray-400 mt-1">Gerencie seus deals e acompanhe as etapas de conversão.</p>
      </div>
      <KanbanBoard leads={leads} onStatusChange={updateStatus} setLeads={setLeads} />
    </div>
  );
};

export { KanbanBoard };
export default KanbanPage;