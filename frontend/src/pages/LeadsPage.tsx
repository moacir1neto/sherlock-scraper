import React, { useEffect, useState } from 'react';
import { LayoutList, Kanban, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeads } from '@/hooks/useLeads';
import ListView from '@/components/leads/ListView';
import { KanbanBoard } from '@/pages/KanbanBoard';

type ViewMode = 'list' | 'kanban';

const LeadsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>('list');
  const [nicheFilter, setNicheFilter] = useState('all');
  const { leads, loading, fetchLeads, updateStatus, setLeads } = useLeads();

  // Extract unique niches from leads
  const uniqueNiches = Array.from(new Set(leads.map(l => l.Nicho).filter(Boolean))).sort();

  // Filter leads based on selected niche
  const filteredLeads = nicheFilter === 'all' 
    ? leads 
    : leads.filter(l => l.Nicho === nicheFilter);

  useEffect(() => { 
    if (id) {
        fetchLeads(id); 
    } else {
        fetchLeads();
    }
  }, [fetchLeads, id]);

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="mb-6 shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard/raspagens')}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white border border-white/5"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
                {id ? 'Leads da Campanha' : 'Todos os Leads'}
            </h1>
            <p className="text-gray-400 mt-1">
              {loading ? 'Carregando...' : `${filteredLeads.length} lead${filteredLeads.length !== 1 ? 's' : ''} encontrados${nicheFilter !== 'all' ? ` (${nicheFilter})` : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Niche Filter Dropdown */}
          <div className="flex items-center gap-2">
            <select
              id="select-nicho"
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-medium text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer hover:border-white/20"
            >
              <option value="all">Todos os Nichos</option>
              {uniqueNiches.map(niche => (
                <option key={niche} value={niche!}>{niche}</option>
              ))}
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1 gap-1">
            <button
              id="btn-view-list"
              onClick={() => setView('list')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'list'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <LayoutList size={16} />
              <span className="hidden sm:inline">Lista</span>
            </button>
            <button
              id="btn-view-kanban"
              onClick={() => setView('kanban')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'kanban'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Kanban size={16} />
              <span className="hidden sm:inline">Kanban</span>
            </button>
          </div>
        </div>
      </div>

      {/* Loading Spinner */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-blue-500 rounded-full" />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          {view === 'list' ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="h-full overflow-auto custom-scrollbar bg-black/20 border border-white/5 rounded-2xl"
            >
              <ListView leads={filteredLeads} onStatusChange={updateStatus} />
            </motion.div>
          ) : (
            <motion.div
              key="kanban"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="h-full flex flex-col"
            >
              <KanbanBoard leads={filteredLeads} onStatusChange={updateStatus} setLeads={setLeads} />
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

export default LeadsPage;
