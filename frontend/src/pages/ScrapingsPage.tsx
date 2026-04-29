import React, { useEffect, useState, useRef } from 'react';
import { useLeads } from '@/hooks/useLeads';
import { 
    Database, 
    Calendar, 
    MapPin, 
    Zap, 
    X, 
    Terminal as TerminalIcon, 
    CheckCircle2, 
    AlertCircle, 
    Loader2,
    Trash2,
    AlertTriangle
} from 'lucide-react';
import { ScrapingJob } from '@/types';
import axios from 'axios';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ScrapeModal from '@/components/leads/ScrapeModal';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = () => import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const ScrapingsPage: React.FC = () => {
    const { scrapeJobs, fetchScrapeJobs, deleteScrapeJob } = useLeads();
    const [scrapeOpen, setScrapeOpen] = useState(false);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [showTerminal, setShowTerminal] = useState(false);
    const [jobLogs, setJobLogs] = useState("");
    const [jobStatus, setJobStatus] = useState<string>("running");
    
    // Delete Confirmation State
    const [jobToDelete, setJobToDelete] = useState<ScrapingJob | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const pollInterval = useRef<NodeJS.Timeout | null>(null);
    const terminalEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchScrapeJobs();
    }, [fetchScrapeJobs]);

    useEffect(() => {
        if (terminalEndRef.current) {
            terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [jobLogs]);

    const startPolling = (jobId: string) => {
        setActiveJobId(jobId);
        setShowTerminal(true);
        setJobLogs("Iniciando campanha...\nConectando ao Docker daemon...\n");
        
        pollInterval.current = setInterval(async () => {
            try {
                const res = await axios.get(`${API_URL()}/protected/scrapes/status?job_id=${jobId}`, {
                    headers: authHeaders()
                });
                setJobLogs(res.data.logs || "Aguardando logs...");
                setJobStatus(res.data.status);

                if (res.data.status !== 'running') {
                    if (pollInterval.current) clearInterval(pollInterval.current);
                    fetchScrapeJobs();
                }
            } catch (err) {
                console.error("Polling error", err);
            }
        }, 2000);
    };

    const handleScrapeStarted = (jobId: string) => {
        setScrapeOpen(false);
        startPolling(jobId);
    };

    const closeTerminal = () => {
        setShowTerminal(false);
        if (pollInterval.current) clearInterval(pollInterval.current);
    };

    const handleDelete = async () => {
        if (!jobToDelete) return;
        setIsDeleting(true);
        await deleteScrapeJob(jobToDelete.ID);
        setIsDeleting(false);
        setJobToDelete(null);
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Raspagens</h1>
                    <p className="text-gray-400 mt-1">Inicie novos jobs e monitore o status em tempo real</p>
                </div>
                <button
                    onClick={() => setScrapeOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20"
                >
                    <Zap size={18} />
                    Nova Raspagem
                </button>
            </div>

            <div className="bg-black/20 border border-white/5 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-white/[0.02] text-gray-500 font-medium border-b border-white/5">
                            <th className="px-6 py-4">Campanha</th>
                            <th className="px-6 py-4">Localização</th>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {scrapeJobs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    Nenhuma campanha realizada ainda.
                                </td>
                            </tr>
                        ) : (
                            scrapeJobs.map((job) => (
                                <tr key={job.ID} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                                <Database size={18} />
                                            </div>
                                            <span className="font-semibold text-white">{job.Nicho}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-gray-400">
                                            <MapPin size={14} />
                                            {job.Localizacao}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar size={14} />
                                            {format(new Date(job.CreatedAt), "dd MMM, HH:mm", { locale: ptBR })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {job.Status === 'running' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20">
                                                <Loader2 size={12} className="animate-spin" />
                                                EM CURSO
                                            </span>
                                        ) : job.Status === 'completed' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                                                <CheckCircle2 size={12} />
                                                CONCLUÍDO
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
                                                <AlertCircle size={12} />
                                                ERRO
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => { setActiveJobId(job.ID); setShowTerminal(true); setJobLogs(job.Logs); setJobStatus(job.Status); }}
                                                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                                                title="Ver Logs"
                                            >
                                                <TerminalIcon size={18} />
                                            </button>
                                            <button 
                                                onClick={() => setJobToDelete(job)}
                                                className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-gray-400 transition-colors"
                                                title="Excluir Raspagem"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Terminal Modal */}
            <AnimatePresence>
                {showTerminal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-4xl bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <span className="ml-2 text-sm font-mono text-gray-400 flex items-center gap-2">
                                        <TerminalIcon size={14} />
                                        sherlock@scraper:~/logs
                                        {jobStatus === 'running' && <Loader2 size={12} className="animate-spin" />}
                                    </span>
                                </div>
                                <button onClick={closeTerminal} className="p-1 hover:bg-white/10 rounded-md transition-colors text-gray-500 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-6 font-mono text-sm custom-scrollbar bg-black/40">
                                <div className="space-y-1">
                                    {jobLogs.split('\n').map((line, i) => (
                                        <div key={i} className={`${line.includes('❌') || line.includes('Erro') ? 'text-red-400' : line.includes('✅') || line.includes('SUCESSO') ? 'text-emerald-400' : 'text-green-500/80'}`}>
                                            <span className="text-blue-500 mr-2">$</span>
                                            {line}
                                        </div>
                                    ))}
                                    <div ref={terminalEndRef} />
                                </div>
                            </div>
                            <div className="px-6 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-[11px] text-gray-500 uppercase tracking-widest font-bold">
                                <span>Status: {jobStatus}</span>
                                <span>Press ESC to close</span>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal (AlertDialog style) */}
            <AnimatePresence>
                {jobToDelete && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="w-full max-w-md bg-[#121214] border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
                        >
                            <div className="p-8">
                                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
                                    <AlertTriangle size={32} />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-3">Excluir Raspagem?</h2>
                                <p className="text-gray-400 leading-relaxed mb-8">
                                    Deseja excluir a raspagem de <strong className="text-white">"{jobToDelete.Nicho}"</strong> em <strong className="text-white">{jobToDelete.Localizacao}</strong> e todos os seus leads vinculados? 
                                    <br /><br />
                                    <span className="text-red-400/80 font-semibold text-sm">Esta ação não pode ser desfeita.</span>
                                </p>
                                
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setJobToDelete(null)}
                                        disabled={isDeleting}
                                        className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold transition-all disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="flex-1 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isDeleting ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                Excluindo...
                                            </>
                                        ) : (
                                            'Confirmar Exclusão'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ScrapeModal
                isOpen={scrapeOpen}
                onClose={() => setScrapeOpen(false)}
                onComplete={handleScrapeStarted}
            />
        </div>
    );
};

export default ScrapingsPage;
