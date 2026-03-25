import { useState, useRef, useEffect } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Copy,
  ArrowRightLeft,
  Trash2,
  History,
  CalendarCheck,
  MessageSquare,
  StickyNote,
  ChevronLeft,
  Brain,
} from 'lucide-react';
import { Lead, AIPipelineStage } from '@/types';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import SidebarInfo from './SidebarInfo';
import TabInteligencia from './TabInteligencia';
import TabHistorico from './TabHistorico';
import TabAtividade from './TabAtividade';
import TabMensagens from './TabMensagens';
import TabObservacoes from './TabObservacoes';

interface LeadDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  stages: AIPipelineStage[];
  onDelete: (leadId: string) => Promise<boolean>;
  onDuplicate: (lead: Lead) => Promise<Lead | null>;
  onMove: (leadId: string, newStageId: string) => Promise<void>;
  onAnalyze?: (leadId: string) => Promise<any>;
}

type TabKey = 'inteligencia' | 'historico' | 'atividade' | 'mensagens' | 'observacoes';

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'inteligencia', label: 'IA', icon: Brain },
  { key: 'historico', label: 'Histórico', icon: History },
  { key: 'atividade', label: 'Atividade', icon: CalendarCheck },
  { key: 'mensagens', label: 'Mensagens', icon: MessageSquare },
  { key: 'observacoes', label: 'Observações', icon: StickyNote },
];

export default function LeadDetailsModal({
  isOpen,
  onClose,
  lead,
  stages,
  onDelete,
  onDuplicate,
  onMove,
  onAnalyze,
}: LeadDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('inteligencia');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [moveSubmenu, setMoveSubmenu] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close "more" dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
        setMoveSubmenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Loss modal state
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [lossDetails, setLossDetails] = useState('');

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab('inteligencia');
      setMoreMenuOpen(false);
      setMoveSubmenu(false);
      setIsLossModalOpen(false);
      setLossReason('');
      setLossDetails('');
    }
  }, [isOpen]);

  if (!lead) return null;

  const handleGanho = async () => {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    toast.success('Negócio Fechado! 🎉');
    const finalStage = stages[stages.length - 1];
    if (finalStage) {
      await onMove(lead.ID, finalStage.id);
    }
    setTimeout(() => onClose(), 1500);
  };

  const handleConfirmPerda = async () => {
    toast.error('Negócio marcado como perdido.');
    await onMove(lead.ID, 'lost');
    setIsLossModalOpen(false);
    onClose();
  };

  const handleDelete = async () => {
    setMoreMenuOpen(false);
    const success = await onDelete(lead.ID);
    if (success) onClose();
  };

  const handleDuplicate = async () => {
    setMoreMenuOpen(false);
    await onDuplicate(lead);
    onClose();
  };

  const handleMove = async (stageId: string) => {
    setMoreMenuOpen(false);
    setMoveSubmenu(false);
    await onMove(lead.ID, stageId);
    onClose();
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'inteligencia':
        return <TabInteligencia lead={lead} onAnalyze={onAnalyze ? (id: string) => onAnalyze(id) : async () => {}} />;
      case 'historico':
        return <TabHistorico lead={lead} stages={stages} />;
      case 'atividade':
        return <TabAtividade />;
      case 'mensagens':
        return <TabMensagens />;
      case 'observacoes':
        return <TabObservacoes />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative w-[95vw] h-[93vh] bg-gray-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* ── HEADER ── */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 shrink-0">
              {/* Left — Close + Title */}
              <div className="flex items-center gap-4">
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <X size={18} className="text-gray-500" />
                </button>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">
                    {lead.Empresa}
                  </h2>
                  <p className="text-xs text-gray-400">{lead.Nicho || 'Sem segmento'}</p>
                </div>
              </div>

              {/* Right — Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGanho}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-sm"
                >
                  <TrendingUp size={16} />
                  Ganho
                </button>
                <button
                  onClick={() => setIsLossModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-sm"
                >
                  <TrendingDown size={16} />
                  Perda
                </button>

                {/* More Dropdown */}
                <div className="relative" ref={moreRef}>
                  <button
                    onClick={() => {
                      setMoreMenuOpen(!moreMenuOpen);
                      setMoveSubmenu(false);
                    }}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold rounded-xl transition-colors"
                  >
                    Mais
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {moreMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50">
                      {moveSubmenu ? (
                        <>
                          {/* Move Submenu — Stage List */}
                          <button
                            onClick={() => setMoveSubmenu(false)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider hover:bg-gray-50 transition-colors"
                          >
                            <ChevronLeft size={14} />
                            Mover para etapa
                          </button>
                          <div className="h-px bg-gray-100 my-1" />
                          {stages.map((stage) => (
                            <button
                              key={stage.id}
                              onClick={() => handleMove(stage.id)}
                              disabled={stage.id === lead.KanbanStatus}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                stage.id === lead.KanbanStatus
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: stage.color }}
                              />
                              {stage.name}
                              {stage.id === lead.KanbanStatus && (
                                <span className="ml-auto text-[10px] text-gray-300 font-medium">
                                  atual
                                </span>
                              )}
                            </button>
                          ))}
                        </>
                      ) : (
                        <>
                          {/* Default Menu */}
                          <button
                            onClick={handleDuplicate}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            <Copy size={14} /> Duplicar
                          </button>
                          <button
                            onClick={() => setMoveSubmenu(true)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            <ArrowRightLeft size={14} /> Mover
                          </button>
                          <div className="h-px bg-gray-100 my-1" />
                          <button
                            onClick={handleDelete}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} /> Excluir
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── BODY (Grid: Workspace + Sidebar) ── */}
            <div className="flex-1 grid grid-cols-[1fr_380px] overflow-hidden">
              {/* Workspace (Left) */}
              <div className="flex flex-col overflow-hidden border-r border-gray-100">
                {/* Tabs */}
                <div className="flex items-center gap-1 px-6 pt-4 pb-0 bg-white shrink-0">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-all ${
                          isActive
                            ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                            : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon size={16} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto">{renderTab()}</div>
              </div>

              {/* Sidebar (Right) */}
              <div className="overflow-y-auto p-5 bg-gray-50">
                <SidebarInfo lead={lead} stages={stages} />
              </div>
            </div>
          </motion.div>

          {/* ── Loss Mini-Modal ── */}
          <AnimatePresence>
            {isLossModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center"
              >
                <div
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setIsLossModalOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
                >
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Marcar negócio como perdido
                  </h3>

                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Motivo da perda
                  </label>
                  <select
                    value={lossReason}
                    onChange={(e) => setLossReason(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition-all mb-4"
                  >
                    <option value="">Selecione um motivo...</option>
                    <option value="preco">Preço</option>
                    <option value="concorrencia">Concorrência</option>
                    <option value="falta_interesse">Falta de Interesse</option>
                    <option value="sem_orcamento">Sem Orçamento</option>
                  </select>

                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Detalhes adicionais{' '}
                    <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={lossDetails}
                    onChange={(e) => setLossDetails(e.target.value)}
                    placeholder="Adicione mais contexto sobre a perda..."
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition-all mb-6"
                  />

                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => setIsLossModalOpen(false)}
                      className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmPerda}
                      disabled={!lossReason}
                      className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all active:scale-95 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Confirmar Perda
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
