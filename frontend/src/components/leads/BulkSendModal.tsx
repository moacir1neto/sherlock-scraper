import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, AlertTriangle, CheckCircle, Smartphone, Loader2 } from 'lucide-react';
import { Lead } from '@/types';
import { instanceService } from '@/modules/whatsapp/services/api';

interface BulkSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeads: Lead[];
  onStartCampaign: (instanceId: string) => Promise<string>;
}

interface LogEvent {
  id: string;
  type: 'start' | 'success' | 'error' | 'skip';
  lead_id: string;
  empresa: string;
  message: string;
}

const BulkSendModal: React.FC<BulkSendModalProps> = ({ isOpen, onClose, selectedLeads, onStartCampaign }) => {
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [loadingInstances, setLoadingInstances] = useState(false);

  const [isSending, setIsSending] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const total = selectedLeads.length;

  useEffect(() => {
    if (isOpen && !isSending && instances.length === 0) {
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
    setIsSending(true);
    setLogs([]);
    setProgress(0);
    
    try {
      const id = await onStartCampaign(selectedInstance);
      setCampaignId(id);
      startSSE(id);
    } catch (error) {
      setIsSending(false);
    }
  };

  const startSSE = (id: string) => {
    const token = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    
    // Conecta na nova rota SSE disparando pelo Redis PubSub
    const es = new EventSource(`${apiUrl}/campaigns/${id}/stream?token=${token}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LogEvent;
        // Adiciona id único ao log para key mapping
        data.id = `${Date.now()}-${Math.random()}`;

        // Atualiza a lista removendo o evento "start" deste lead se chegou success/error/skip
        setLogs((prev) => {
          let newLogs = [...prev];
          if (data.type !== 'start') {
             // Remove o evento "start" pendente deste lead (se existir)
             newLogs = newLogs.filter((l) => !(l.lead_id === data.lead_id && l.type === 'start'));
             setProgress((p) => Math.min(p + 1, total));
          }
          return [...newLogs, data];
        });
        
        scrollToBottom();
      } catch (err) {
        console.error('Erro ao processar evento SSE', err);
      }
    };

    es.onerror = (err) => {
      console.error('Erro de conexão SSE:', err);
      es.close();
    };
  };

  // Garante fechamento do SSE
  useEffect(() => {
    if (progress >= total && progress > 0 && eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsSending(false);
    }
  }, [progress, total]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleClose = () => {
    if (isSending) return; // Block closing if sending
    if (eventSourceRef.current) eventSourceRef.current.close();
    setCampaignId(null);
    setLogs([]);
    setProgress(0);
    setIsSending(false);
    onClose();
  };

  const progressPercent = total > 0 ? Math.round((progress / total) * 100) : 0;

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
                    <p className="text-sm text-gray-400">Envio assíncrono para {total} leads selecionados</p>
                  </div>
                </div>
                {!isSending && (
                  <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                    <X size={20} />
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="p-6 flex-1 overflow-auto bg-black/20 flex flex-col gap-6">
                
                {/* Status Bar / Instance Selector */}
                {!campaignId ? (
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
                ) : (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3 border-none pb-0">
                      <span className="text-sm font-medium text-gray-300">Progresso do Disparo</span>
                      <span className="text-sm font-bold text-white">{progress}/{total} ({progressPercent}%)</span>
                    </div>
                    <div className="w-full bg-black/40 rounded-full h-3 mb-1 border border-white/5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full"
                      />
                    </div>
                  </div>
                )}

                {/* Logs Terminal */}
                {campaignId && (
                  <div className="flex-1 min-h-[300px] max-h-[400px] border border-white/10 rounded-xl bg-[#050505] p-1 flex flex-col font-mono text-sm shadow-inner relative">
                    <div className="px-4 py-2 border-b border-white/5 text-gray-500 text-xs flex justify-between items-center bg-white/[0.01]">
                      <span>terminal logs</span>
                      {isSending && <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>}
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                      {logs.length === 0 && isSending && (
                        <div className="text-gray-500 flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin" />
                          <span>Aguardando worker Asynq processar eventos...</span>
                        </div>
                      )}
                      
                      {logs.map((log) => (
                        <div key={log.id} className="flex gap-2">
                          <span className="shrink-0 text-gray-500">{new Date().toLocaleTimeString('pt-BR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
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
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/5 bg-white/[0.01] flex justify-end gap-3">
                <button
                  onClick={handleClose}
                  disabled={isSending}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  {campaignId && !isSending ? 'Fechar' : 'Cancelar'}
                </button>
                
                {!campaignId && (
                  <button
                    onClick={startCampaign}
                    disabled={isSending || instances.length === 0 || !selectedInstance}
                    className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg shadow-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <Send size={16} className="group-hover:translate-x-1 transition-transform" />
                    Iniciar Campanha
                  </button>
                )}
                {campaignId && !isSending && (
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
