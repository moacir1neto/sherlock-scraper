import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, AlertTriangle, CheckCircle, Smartphone, Loader2 } from 'lucide-react';
import { Lead } from '@/types';
import { instanceService } from '@/modules/whatsapp/services/api';
import { useBulkCampaign } from '@/contexts/BulkCampaignContext';

interface BulkSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeads: Lead[];
  onStartCampaign: (instanceId: string) => Promise<string>;
}

const BulkSendModal: React.FC<BulkSendModalProps> = ({ isOpen, onClose, selectedLeads, onStartCampaign }) => {
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const { isSending, isComplete, progress, total, logs, startTracking } = useBulkCampaign();

  const progressPercent = total > 0 ? Math.round((progress / total) * 100) : 0;
  const isActive = isSending || isComplete;

  useEffect(() => {
    if (isOpen && instances.length === 0) {
      loadInstances();
    }
  }, [isOpen]);

  const loadInstances = async () => {
    setLoadingInstances(true);
    try {
      const data = await instanceService.list();
      setInstances(data);
      if (data.length > 0) {
        setSelectedInstance(data[0].instance.instanceName);
      }
    } catch (error) {
      console.error('Falha ao carregar instâncias', error);
    } finally {
      setLoadingInstances(false);
    }
  };

  const startCampaign = async () => {
    if (!selectedInstance) return;
    setIsStarting(true);
    try {
      const id = await onStartCampaign(selectedInstance);
      startTracking(id, selectedLeads.length);
    } catch {
      // error already toasted in useLeads
    } finally {
      setIsStarting(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <React.Fragment>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
            onClick={handleClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0b0c10] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
              style={{ maxHeight: 'calc(100vh - 40px)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/20">
                    <Send size={20} className="text-green-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-wide">Disparo em Massa</h2>
                    <p className="text-sm text-gray-400">Envio assíncrono para {selectedLeads.length} leads selecionados</p>
                  </div>
                </div>
                <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 flex-1 overflow-auto bg-black/20 flex flex-col gap-6">

                {/* Instance Selector — hidden while campaign is running */}
                {!isActive && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Instância do WhatsApp</label>
                    <div className="relative">
                      {loadingInstances ? (
                        <div className="flex items-center text-gray-400 text-sm">
                          <Loader2 size={16} className="animate-spin mr-2" />
                          Carregando instâncias...
                        </div>
                      ) : instances.length === 0 ? (
                        <div className="text-red-400 text-sm flex items-center">
                          <AlertTriangle size={16} className="mr-2" />
                          Você não tem nenhuma instância conectada no momento.
                        </div>
                      ) : (
                        <div className="relative">
                          <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <select
                            value={selectedInstance}
                            onChange={(e) => setSelectedInstance(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            {instances.map((inst, i) => (
                              <option key={i} value={inst.instance.instanceName}>
                                {inst.instance.instanceName} {inst.instance.status === 'open' ? '🟢 (Conectada)' : '🔴 (Offline)'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                {isActive && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-300">Progresso do Disparo</span>
                      <span className="text-sm font-bold text-white">{progress}/{total} ({progressPercent}%)</span>
                    </div>
                    <div className="w-full bg-black/40 rounded-full h-3 mb-1 border border-white/5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        className={`h-full ${isComplete ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}
                      />
                    </div>
                    {isSending && (
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                        </span>
                        Rodando em segundo plano — você pode fechar este modal
                      </p>
                    )}
                  </div>
                )}

                {/* Logs Terminal */}
                {isActive && logs.length > 0 && (
                  <div className="flex-1 min-h-[200px] max-h-[320px] border border-white/10 rounded-xl bg-[#050505] p-1 flex flex-col font-mono text-sm shadow-inner">
                    <div className="px-4 py-2 border-b border-white/5 text-gray-500 text-xs flex justify-between items-center bg-white/[0.01]">
                      <span>terminal logs</span>
                      {isSending && (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                      )}
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                      {logs.map((log) => (
                        <div key={log.id} className="flex gap-2">
                          <span className="shrink-0 text-gray-500">
                            {new Date().toLocaleTimeString('pt-BR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className={`${
                            log.type === 'start' ? 'text-blue-400' :
                            log.type === 'success' ? 'text-green-400' :
                            log.type === 'skip' ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/5 bg-white/[0.01] flex justify-end gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {isComplete ? 'Fechar' : isSending ? 'Minimizar' : 'Cancelar'}
                </button>

                {!isActive && (
                  <button
                    onClick={startCampaign}
                    disabled={isStarting || instances.length === 0 || !selectedInstance}
                    className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg shadow-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {isStarting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} className="group-hover:translate-x-1 transition-transform" />
                    )}
                    {isStarting ? 'Iniciando...' : 'Iniciar Campanha'}
                  </button>
                )}

                {isComplete && (
                  <button
                    onClick={handleClose}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg font-medium transition-all"
                  >
                    <CheckCircle size={16} />
                    Concluído
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
};

export default React.memo(BulkSendModal);
