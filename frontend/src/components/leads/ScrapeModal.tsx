import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, Search, MapPin, Loader2, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = () => import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const getToken = () => localStorage.getItem('token');

type ScrapeState = 'idle' | 'loading' | 'success' | 'error';

interface ScrapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void; // callback to refresh leads
}

const ScrapeModal: React.FC<ScrapeModalProps> = ({ isOpen, onClose, onComplete }) => {
  const [nicho, setNicho] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [state, setState] = useState<ScrapeState>('idle');
  const [message, setMessage] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount or close
  useEffect(() => {
    if (!isOpen) {
      if (pollRef.current) clearInterval(pollRef.current);
      setState('idle');
      setMessage('');
      setJobId(null);
    }
  }, [isOpen]);

  // Poll for job status
  useEffect(() => {
    if (!jobId) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL()}/protected/scrape/status`, {
          params: { job_id: jobId },
          headers: { Authorization: `Bearer ${getToken()}` },
        });

        const { status, output } = res.data;

        if (status === 'done') {
          clearInterval(pollRef.current!);
          setState('success');
          setMessage('Raspagem concluída! Novos leads foram adicionados.');
          onComplete();
        } else if (status === 'error') {
          clearInterval(pollRef.current!);
          setState('error');
          setMessage(output || 'Ocorreu um erro durante a raspagem.');
        }
        // If 'running', keep polling
      } catch {
        clearInterval(pollRef.current!);
        setState('error');
        setMessage('Erro ao verificar o status da raspagem.');
      }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId, onComplete]);

  const handleStart = async () => {
    if (!nicho.trim() || !localizacao.trim()) return;

    setState('loading');
    setMessage('Iniciando o Sherlock... Isso pode levar alguns minutos. ☕');

    try {
      const res = await axios.post(
        `${API_URL()}/protected/scrape`,
        { nicho: nicho.trim(), localizacao: localizacao.trim() },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setJobId(res.data.job_id);
    } catch (err: any) {
      setState('error');
      setMessage(err?.response?.data?.error || 'Falha ao iniciar a raspagem.');
    }
  };

  const handleClose = () => {
    if (state === 'loading') return; // prevent close while running
    if (state === 'success' || state === 'error') {
      setState('idle');
      setNicho('');
      setLocalizacao('');
      setJobId(null);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.7)' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-[#111113] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="relative p-6 border-b border-white/5">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <Zap size={18} className="text-blue-400" />
                </div>
                <h2 className="text-lg font-bold text-white">Nova Raspagem</h2>
              </div>
              <p className="text-sm text-gray-500 ml-12">
                O Sherlock vai caçar leads no Google Maps para você.
              </p>
              {state !== 'loading' && (
                <button
                  onClick={handleClose}
                  className="absolute top-5 right-5 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Idle / Loading form */}
              {(state === 'idle' || state === 'loading') && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <Search size={13} className="text-blue-400" />
                      Nicho
                    </label>
                    <input
                      type="text"
                      value={nicho}
                      onChange={(e) => setNicho(e.target.value)}
                      placeholder="Ex: Dentista, Advogado, Academia..."
                      disabled={state === 'loading'}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <MapPin size={13} className="text-blue-400" />
                      Localização
                    </label>
                    <input
                      type="text"
                      value={localizacao}
                      onChange={(e) => setLocalizacao(e.target.value)}
                      placeholder="Ex: Florianópolis SC, Centro São Paulo..."
                      disabled={state === 'loading'}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all disabled:opacity-50"
                      onKeyDown={(e) => { if (e.key === 'Enter' && state === 'idle') handleStart(); }}
                    />
                  </div>

                  {/* Loading state feedback */}
                  {state === 'loading' && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <Loader2 size={18} className="text-blue-400 shrink-0 mt-0.5 animate-spin" />
                      <div>
                        <p className="text-sm font-medium text-blue-300">Raspagem em andamento</p>
                        <p className="text-xs text-blue-400/70 mt-0.5">{message}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Success state */}
              {state === 'success' && (
                <div className="flex flex-col items-center py-6 gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 size={32} className="text-emerald-400" />
                  </div>
                  <p className="text-base font-semibold text-white">Missão Cumprida!</p>
                  <p className="text-sm text-gray-400 text-center">{message}</p>
                </div>
              )}

              {/* Error state */}
              {state === 'error' && (
                <div className="flex flex-col items-center py-6 gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                    <AlertCircle size={32} className="text-red-400" />
                  </div>
                  <p className="text-base font-semibold text-white">Algo deu errado</p>
                  <p className="text-sm text-gray-400 text-center max-w-[300px]">{message}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex justify-end gap-3">
              {(state === 'idle') && (
                <>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleStart}
                    disabled={!nicho.trim() || !localizacao.trim()}
                    className="px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] flex items-center gap-2"
                  >
                    <Zap size={15} />
                    Iniciar Raspagem
                  </button>
                </>
              )}
              {(state === 'success' || state === 'error') && (
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 text-sm font-semibold bg-white/10 hover:bg-white/15 text-white rounded-xl transition-colors"
                >
                  Fechar
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ScrapeModal;
