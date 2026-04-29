import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, CheckCircle } from 'lucide-react';
import { useBulkCampaign } from '@/contexts/BulkCampaignContext';

const CampaignProgressBadge: React.FC = () => {
  const { isSending, isComplete, progress, total, reset } = useBulkCampaign();

  const visible = isSending || isComplete;
  const percent = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-50 w-72 bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              {isComplete ? (
                <CheckCircle size={16} className="text-green-400" />
              ) : (
                <Send size={16} className="text-green-400" />
              )}
              <span className="text-sm font-semibold text-white">
                {isComplete ? 'Disparo concluído' : 'Disparando em massa'}
              </span>
            </div>
            {isComplete && (
              <button
                onClick={reset}
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Progress */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>{isComplete ? 'Finalizado' : 'Em andamento...'}</span>
              <span className="font-mono text-white">
                {progress}/{total} ({percent}%)
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  isComplete
                    ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                }`}
              />
            </div>
          </div>

          {/* Sending pulse */}
          {isSending && (
            <div className="px-4 pb-3 flex items-center gap-2 text-xs text-gray-500">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Você pode continuar navegando normalmente
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CampaignProgressBadge;
