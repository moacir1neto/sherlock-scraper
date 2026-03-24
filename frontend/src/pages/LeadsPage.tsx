import React, { useEffect, useState } from 'react';
import { LayoutList, Kanban, ChevronLeft, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLeads } from '@/hooks/useLeads';
import ListView from '@/components/leads/ListView';
import { KanbanBoard } from '@/pages/KanbanBoard';
import LeadDetailsModal from '@/components/leads/LeadDetailsModal';
import { Lead } from '@/types';

type ViewMode = 'list' | 'kanban';

const LeadsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<ViewMode>('list');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { leads, scrapeJobs, loading, fetchLeads, fetchScrapeJobs, updateStatus, updateLead, analyzeLead, setLeads } = useLeads();

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  // Determine origin module from URL
  const fromListas = location.pathname.includes('/listas/');
  const backPath = fromListas ? '/dashboard/listas' : '/dashboard/raspagens';
  const backLabel = fromListas ? 'Minhas Listas' : 'Raspagens';

  // Find the campaign that matches this route's :id
  const currentJob = id ? scrapeJobs.find((j) => j.ID === id) : undefined;

  // Build a readable page title from the campaign data
  const campaignTitle = currentJob
    ? `${currentJob.Nicho} em ${currentJob.Localizacao}`
    : 'Leads da Campanha';

  useEffect(() => {
    // Always fetch the campaigns list so we can resolve the campaign name
    fetchScrapeJobs();
    if (id) {
      fetchLeads(id);
    }
  }, [fetchLeads, fetchScrapeJobs, id]);

  return (
    <>
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="mb-6 shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(backPath)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white border border-white/5"
            title={`Voltar para ${backLabel}`}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1 font-medium uppercase tracking-wider">
              <span
                onClick={() => navigate(backPath)}
                className="cursor-pointer hover:text-gray-300 transition-colors"
              >
                {backLabel}
              </span>
              <span>/</span>
              <span className="text-blue-400">Leads</span>
            </div>
            {/* Title */}
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              {campaignTitle}
              {currentJob && (
                <span className="flex items-center gap-1 text-sm font-normal text-gray-400 mt-1">
                  <MapPin size={14} />
                  {currentJob.Localizacao}
                </span>
              )}
            </h1>
            <p className="text-gray-400 mt-1">
              {loading
                ? 'Carregando...'
                : `${leads.length} lead${leads.length !== 1 ? 's' : ''} encontrados`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
              <ListView leads={leads} onStatusChange={updateStatus} onLeadClick={handleLeadClick} />
            </motion.div>
          ) : (
            <motion.div
              key="kanban"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="h-full flex flex-col"
            >
              <KanbanBoard leads={leads} onStatusChange={updateStatus} setLeads={setLeads} onLeadClick={handleLeadClick} />
            </motion.div>
          )}
        </div>
      )}
    </div>

      {/* Lead Details Modal */}
      <LeadDetailsModal
        lead={selectedLead}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onStatusChange={(leadId, newStatus) => {
          updateStatus(leadId, newStatus);
          // Keep selectedLead in sync so the badge updates immediately
          if (selectedLead && selectedLead.ID === leadId) {
            setSelectedLead({ ...selectedLead, KanbanStatus: newStatus });
          }
        }}
        onUpdateLead={(updatedLead) => {
          updateLead(updatedLead);
          if (selectedLead && selectedLead.ID === updatedLead.ID) {
            setSelectedLead(updatedLead);
          }
        }}
        onAnalyzeLead={async (leadId) => {
          const analysis = await analyzeLead(leadId);
          // Update selectedLead with new analysis
          if (selectedLead && selectedLead.ID === leadId) {
            setSelectedLead({ ...selectedLead, AIAnalysis: analysis });
          }
          return analysis;
        }}
      />
    </>
  );
};

export default LeadsPage;
