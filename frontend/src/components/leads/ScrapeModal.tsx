import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Search, MapPin, Loader2, Zap, Play, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = () => import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const getToken = () => localStorage.getItem('token');

interface ScrapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (jobId: string) => void; 
}

const ScrapeModal: React.FC<ScrapeModalProps> = ({ isOpen, onClose, onComplete }) => {
  const [nicho, setNicho] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setNicho('');
      setLocalizacao('');
      setLimit(20);
      setLoading(false);
      setError('');
    }
  }, [isOpen]);

  const handleStart = async () => {
    if (!nicho.trim() || !localizacao.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await axios.post(
        `${API_URL()}/protected/scrape`,
        { nicho: nicho.trim(), localizacao: localizacao.trim(), limit: Number(limit) },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      onComplete(res.data.job_id);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Falha ao iniciar a raspagem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full max-w-md bg-[#111113] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="relative p-6 border-b border-white/5">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Zap size={18} />
                </div>
                <h2 className="text-lg font-bold text-white">Nova Raspagem</h2>
              </div>
              <p className="text-sm text-gray-500">Configuração da campanha de extração</p>
              <button
                onClick={onClose}
                className="absolute top-5 right-5 p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-500 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Search size={13} className="text-blue-400" />
                  Nicho de busca
                </label>
                <input
                  type="text"
                  value={nicho}
                  onChange={(e) => setNicho(e.target.value)}
                  placeholder="Ex: Dentista, Advogado, Academia..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <MapPin size={13} className="text-blue-400" />
                  Localização (Cidade/Estado)
                </label>
                <input
                  type="text"
                  value={localizacao}
                  onChange={(e) => setLocalizacao(e.target.value)}
                  placeholder="Ex: Florianópolis SC..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Hash size={13} className="text-blue-400" />
                  Quantidade de Leads (Máx 100)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={limit}
                  onChange={(e) => {
                    let val = parseInt(e.target.value);
                    if (isNaN(val)) val = 1;
                    if (val > 100) val = 100;
                    if (val < 1) val = 1;
                    setLimit(val);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              {error && (
                <div className="p-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
                  {error}
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleStart}
                disabled={loading || !nicho.trim() || !localizacao.trim()}
                className="px-6 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all flex items-center gap-2 disabled:bg-blue-600/50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Iniciar Raspagem
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ScrapeModal;
