import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, User, Bot, Plug } from 'lucide-react';
import AISettingsTab from '@/components/settings/AISettingsTab';
import GeneralSettingsTab from '@/components/settings/GeneralSettingsTab';
import IntegrationsTab from '@/components/settings/IntegrationsTab';

const TABS = [
  { id: 'general', name: 'Perfil Geral', icon: User },
  { id: 'ai', name: 'Inteligência Artificial', icon: Bot },
  { id: 'integrations', name: 'Integrações', icon: Plug },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TAB_COMPONENTS: Record<TabId, React.FC> = {
  general: GeneralSettingsTab,
  ai: AISettingsTab,
  integrations: IntegrationsTab,
};

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('ai');

  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl">
          <Settings className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-gray-500">
            Gerencie as configurações do sistema.
          </p>
        </div>
      </div>

      {/* Mobile: horizontal scrollable tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 lg:hidden scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
              activeTab === tab.id
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                : 'bg-glass/50 border border-glass-border text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <tab.icon size={18} />
            {tab.name}
          </button>
        ))}
      </div>

      {/* Desktop: two-column layout */}
      <div className="flex gap-6">
        {/* Sidebar nav (desktop only) */}
        <nav className="hidden lg:flex flex-col w-64 shrink-0 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-left transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <tab.icon size={20} className="shrink-0" />
              {tab.name}
            </button>
          ))}
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default SettingsPage;
