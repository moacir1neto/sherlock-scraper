import React, { useEffect, useState } from 'react';
import { LayoutList, Kanban, ChevronLeft, MapPin, Brain, Sparkles, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
  
  const { 
    leads, 
    scrapeJobs, 
    loading, 
    fetchLeads, 
    fetchScrapeJobs, 
    updateStatus, 
    updateLead, 
    analyzeLead, 
    analyzeLeadsBulk,
    setLeads 
  } = useLeads();

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
      setSelectedIds([]); // Clear selection when job changes
    }
  }, [fetchLeads, fetchScrapeJobs, id]);

  const handleBulkAnalyze = async () => {
    if (selectedIds.length === 0) return;

    // Filter out leads that already have an AI dossier
    const idsWithoutDossier = selectedIds.filter(
      (sid) => !leads.find((l) => l.ID === sid)?.ai_analysis
    );

    if (idsWithoutDossier.length === 0) {
      toast('Todos os leads selecionados já possuem Dossiê de IA.', {
        icon: '✅',
        style: { borderRadius: '12px', background: '#1e1b4b', color: '#fff' },
      });
      return;
    }

    const skipped = selectedIds.length - idsWithoutDossier.length;

    setIsBulkAnalyzing(true);
    toast(
      `A IA está analisando ${idsWithoutDossier.length} leads.${skipped > 0 ? ` ${skipped} já analisado(s) foram ignorados.` : ''} Isso pode levar alguns segundos...`,
      {
        icon: '🧠',
        style: { borderRadius: '12px', background: '#1e1b4b', color: '#fff' },
        duration: 5000,
      }
    );

    try {
      await analyzeLeadsBulk(idsWithoutDossier);
      setSelectedIds([]);
      if (id) {
        await fetchLeads(id);
      }
    } catch (error) {
      // Error handled in useLeads
    } finally {
      setIsBulkAnalyzing(false);
    }
  };

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
          {/* Bulk AI Action */}
          <AnimatePresence>
            {selectedIds.length > 0 && view === 'list' && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 20 }}
                onClick={handleBulkAnalyze}
                disabled={isBulkAnalyzing}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-500/20 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkAnalyzing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Brain size={16} className="group-hover:rotate-12 transition-transform" />
                )}
                <span>
                  {isBulkAnalyzing ? 'Analisando...' : `Analisar ${selectedIds.length} Leads`}
                </span>
                {!isBulkAnalyzing && <Sparkles size={14} className="text-white/60" />}
              </motion.button>
            )}
          </AnimatePresence>

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
              <ListView 
                leads={leads} 
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onStatusChange={updateStatus} 
                onLeadClick={handleLeadClick} 
              />
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
            setSelectedLead({ ...selectedLead, ai_analysis: analysis });
          }
          return analysis;
        }}
      />
    </>
  );
};

export default LeadsPage;
