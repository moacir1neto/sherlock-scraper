import React, { useState, useEffect } from 'react';
import { X, Send, AlertTriangle, CheckCircle, Smartphone, Loader2 } from 'lucide-react';
import { Lead } from '../../types';
import { instanceService } from '../../services/api';
import { useBulkCampaign } from '../../contexts/BulkCampaignContext';

interface BulkSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeads: Lead[];
  onStartCampaign: (instanceId: string, leads: Partial<Lead>[]) => Promise<string>;
}

interface MappedInstance {
  instanceName: string;
  status: string;
  [key: string]: any;
}

export function BulkSendModal({ isOpen, onClose, selectedLeads, onStartCampaign }: BulkSendModalProps) {
  const [instances, setInstances] = useState<MappedInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const { isSending, isComplete, progress, logs, startTracking } = useBulkCampaign();
  const total = selectedLeads.length;
  const isActive = isSending || isComplete;

  useEffect(() => {
    if (isOpen && !isActive && instances.length === 0) {
      loadInstances();
    }
  }, [isOpen]);

  const loadInstances = async () => {
    setLoadingInstances(true);
    try {
      const data = await instanceService.list();

      let rawList: MappedInstance[] = [];
      if (Array.isArray(data)) {
        rawList = data.map((item: any) => {
          if (item.instance) {
            return {
              instanceName: item.instanceName || item.instance.instanceName || item.instance.id || item.instance.ID || '',
              status: item.instance.status || 'close',
              ...item.instance,
            };
          }
          return {
            instanceName: item.instanceName || item.id || item.ID || '',
            status: item.status || 'close',
            ...item,
          };
        }).filter((item: MappedInstance) => item.instanceName);
      } else if (data && typeof data === 'object') {
        const instancesArray = (data as any).instances || (data as any).data || [];
        if (Array.isArray(instancesArray)) {
          rawList = instancesArray.map((item: any) => ({
            instanceName: item.instanceName || item.instance?.instanceName || item.id || item.ID || '',
            status: item.status || item.instance?.status || 'close',
            ...item,
          })).filter((item: MappedInstance) => item.instanceName);
        }
      }

      const instancesWithStatus = await Promise.all(
        rawList.map(async (inst) => {
          try {
            const statusData = await instanceService.status(inst.instanceName);
            const state = statusData.instance?.state || statusData.status || inst.status || 'close';
            return {
              ...inst,
              status: state === 'open' ? 'open' : state === 'connecting' ? 'connecting' : 'close',
            };
          } catch {
            return inst;
          }
        })
      );

      setInstances(instancesWithStatus);
      if (instancesWithStatus.length > 0) {
        setSelectedInstance(instancesWithStatus[0].instanceName);
      } else {
        setSelectedInstance('');
      }
    } catch (error) {
      console.error('Falha ao carregar instâncias', error);
      setSelectedInstance('');
    } finally {
      setLoadingInstances(false);
    }
  };

  const startCampaign = async () => {
    if (!selectedInstance) return;
    setIsStarting(true);
    try {
      const id = await onStartCampaign(selectedInstance, selectedLeads);
      startTracking(id, selectedLeads.length);
    } catch {
      // error handled by caller
    } finally {
      setIsStarting(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  const progressPercent = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col transition-all duration-300"
        style={{ maxHeight: 'calc(100vh - 40px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <Send size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Disparo em Massa</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Envio para {selectedLeads.length} leads selecionados</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 flex flex-col gap-6">
          {!isActive ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Instância do WhatsApp</label>
              <div className="relative">
                {loadingInstances ? (
                  <div className="flex items-center text-gray-500 text-sm">
                    <Loader2 size={16} className="animate-spin mr-2" />
                    Carregando instâncias...
                  </div>
                ) : instances.length === 0 ? (
                  <div className="text-red-500 text-sm flex items-center">
                    <AlertTriangle size={16} className="mr-2" />
                    Você não tem nenhuma instância conectada no momento.
                  </div>
                ) : (
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select
                      value={selectedInstance}
                      onChange={(e) => setSelectedInstance(e.target.value)}
                      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 pl-10 pr-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    >
                      {instances.map((inst, i) => {
                        const name = inst?.instanceName || 'Instância Desconhecida';
                        const isConnected = inst?.status === 'open';
                        return (
                          <option key={`${name}-${i}`} value={name}>
                            {name} {isConnected ? '🟢 (Conectada)' : '🔴 (Offline)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progresso do Disparo</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{progress}/{total} ({progressPercent}%)</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary-600 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {isSending && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                  </span>
                  Rodando em segundo plano — você pode minimizar este modal
                </p>
              )}
            </div>
          )}

          {/* Logs */}
          {isActive && logs.length > 0 && (
            <div className="flex-1 min-h-[300px] max-h-[400px] border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-900 flex flex-col font-mono text-sm shadow-inner relative overflow-hidden">
              <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 text-gray-400 text-xs flex justify-between items-center">
                <span>terminal_logs</span>
                {isSending && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                )}
              </div>
              <div className="p-4 flex-1 overflow-y-auto space-y-2 custom-scrollbar text-gray-300">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-2">
                    <span className="shrink-0 text-gray-600">
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
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {isComplete ? 'Fechar' : isSending ? 'Minimizar' : 'Cancelar'}
          </button>

          {!isActive && (
            <button
              onClick={startCampaign}
              disabled={isStarting || instances.length === 0 || !selectedInstance}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStarting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {isStarting ? 'Iniciando...' : 'Iniciar Campanha'}
            </button>
          )}

          {isComplete && (
            <button
              onClick={handleClose}
              className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm font-medium transition-colors"
            >
              <CheckCircle size={16} />
              Concluído
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
