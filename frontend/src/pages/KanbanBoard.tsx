import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Lead, KanbanStatus } from '@/types';
import LeadCard from '@/components/leads/LeadCard';

const COLUMNS: { id: KanbanStatus; title: string }[] = [
  { id: 'prospeccao', title: 'Prospecção' },
  { id: 'contatado', title: 'Contatado' },
  { id: 'reuniao_agendada', title: 'Reunião Agendada' },
  { id: 'negociacao', title: 'Negociação' },
  { id: 'ganho', title: 'Ganho' },
  { id: 'perdido', title: 'Perdido' },
];

const KanbanBoard: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // 1️⃣ Ajuste aqui: Pegando o token do Local Storage
  const getToken = () => localStorage.getItem('token');

  const fetchLeads = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      // 2️⃣ Ajuste aqui: Adicionando o '/protected' na URL e o Token no cabeçalho
      const res = await axios.get(`${apiUrl}/protected/leads`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      setLeads(res.data.leads || []);
    } catch (err) {
      toast.error('Failed to load leads');
      console.error(err); // Dica: Adicione um console.error para facilitar a depuração no futuro
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const leadIndex = leads.findIndex(l => l.ID === draggableId);
    if (leadIndex === -1) return;

    // Keep a snapshot of previous state for instant rollback
    const previousLeads = [...leads];

    const updatedLeads = [...leads];
    const newStatus = destination.droppableId as KanbanStatus;
    updatedLeads[leadIndex] = { ...updatedLeads[leadIndex], KanbanStatus: newStatus };
    
    // Optimistic UI Update
    setLeads(updatedLeads);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      // 3️⃣ Ajuste aqui: Adicionando o '/protected' na URL e o Token no cabeçalho do PATCH
      await axios.patch(`${apiUrl}/protected/leads/${draggableId}/status`, 
        { status: newStatus },
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );
    } catch (err) {
      toast.error('Failed! Reverting status update...');
      // Revert instantly if API fails
      setLeads(previousLeads);
    }
  };

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
        <p className="text-gray-400 mt-1">Manage your active deals and track conversion stages.</p>
      </div>

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
    </div>
  );
};

export default KanbanBoard;