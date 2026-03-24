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
} from 'lucide-react';
import { Lead, AIPipelineStage } from '@/types';
import { AnimatePresence, motion } from 'framer-motion';
import SidebarInfo from './SidebarInfo';
import TabHistorico from './TabHistorico';
import TabAtividade from './TabAtividade';
import TabMensagens from './TabMensagens';
import TabObservacoes from './TabObservacoes';

interface LeadDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  stages: AIPipelineStage[];
}

type TabKey = 'historico' | 'atividade' | 'mensagens' | 'observacoes';

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
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
}: LeadDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('historico');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close "more" dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset tab on open
  useEffect(() => {
    if (isOpen) setActiveTab('historico');
  }, [isOpen]);

  if (!lead) return null;

  const renderTab = () => {
    switch (activeTab) {
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
                <button className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-sm">
                  <TrendingUp size={16} />
                  Ganho
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-sm">
                  <TrendingDown size={16} />
                  Perda
                </button>

                {/* More Dropdown */}
                <div className="relative" ref={moreRef}>
                  <button
                    onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold rounded-xl transition-colors"
                  >
                    Mais
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {moreMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50">
                      <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        <Copy size={14} /> Duplicar
                      </button>
                      <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        <ArrowRightLeft size={14} /> Mover
                      </button>
                      <div className="h-px bg-gray-100 my-1" />
                      <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={14} /> Excluir
                      </button>
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
