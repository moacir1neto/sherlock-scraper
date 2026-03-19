import React, { useEffect } from 'react';
import { useLeads } from '@/hooks/useLeads';
import {
  Database,
  Calendar,
  MapPin,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ListsPage: React.FC = () => {
  const { scrapeJobs, fetchScrapeJobs } = useLeads();
  const navigate = useNavigate();

  useEffect(() => {
    fetchScrapeJobs();
  }, [fetchScrapeJobs]);

  // Only show completed campaigns (they have leads to view)
  const availableLists = scrapeJobs.filter(
    (job) => job.Status === 'completed'
  );
  const allJobs = scrapeJobs;

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Minhas Listas</h1>
          <p className="text-gray-400 mt-1">
            Acesse e gerencie os leads capturados por campanha
          </p>
        </div>
        {/* Summary badge */}
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-semibold">
          <Users size={16} />
          {availableLists.length} lista{availableLists.length !== 1 ? 's' : ''} disponíve{availableLists.length !== 1 ? 'is' : 'l'}
        </div>
      </div>

      {/* Table */}
      <div className="bg-black/20 border border-white/5 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-white/[0.02] text-gray-500 font-medium border-b border-white/5">
              <th className="px-6 py-4">Campanha</th>
              <th className="px-6 py-4">Localização</th>
              <th className="px-6 py-4">Data</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {allJobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-500">
                    <Database size={32} className="opacity-30" />
                    <p>Nenhuma campanha encontrada.</p>
                    <p className="text-xs text-gray-600">
                      Inicie uma raspagem para criar sua primeira lista.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              allJobs.map((job) => (
                <tr
                  key={job.ID}
                  className="hover:bg-white/[0.02] transition-colors group"
                >
                  {/* Campaign name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                        <Database size={18} />
                      </div>
                      <div>
                        <span className="font-semibold text-white block">
                          {job.Nicho}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <MapPin size={14} />
                      {job.Localizacao}
                    </div>
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4 text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {format(new Date(job.CreatedAt), 'dd MMM, HH:mm', {
                        locale: ptBR,
                      })}
                    </div>
                  </td>

                  {/* Status badge */}
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

                  {/* Action: Ver Leads — only for completed */}
                  <td className="px-6 py-4 text-right">
                    {job.Status === 'completed' ? (
                      <button
                        onClick={() =>
                          navigate(`/dashboard/listas/${job.ID}/leads`)
                        }
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-xs font-bold rounded-lg transition-all border border-emerald-500/20 ml-auto"
                      >
                        Ver Leads
                        <ChevronRight size={14} />
                      </button>
                    ) : (
                      <span className="text-gray-600 text-xs font-medium">
                        {job.Status === 'running' ? 'Aguardando...' : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ListsPage;
