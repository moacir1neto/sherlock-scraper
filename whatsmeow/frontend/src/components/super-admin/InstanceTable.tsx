import { useState } from 'react';
import { Trash2, Server } from 'lucide-react';
import { Button } from '../Button';
import { superAdminService } from '../../services/superAdmin';
import { SuperAdminInstance } from '../../types';
import { toast } from 'react-hot-toast';

interface InstanceTableProps {
  instances: SuperAdminInstance[];
  onRefresh: () => void;
}

export function InstanceTable({ instances, onRefresh }: InstanceTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta instância?')) {
      return;
    }

    try {
      setDeletingId(id);
      await superAdminService.deleteInstance(id);
      toast.success('Instância excluída com sucesso!');
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir instância');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg overflow-hidden">
      <div className="p-6 border-b border-gray-200/60 dark:border-gray-700/60 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
          <Server size={22} />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white leading-tight">Instâncias do Sistema</h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
            Monitoramento de serviços ativos ({instances.length})
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50/50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Identificação do Serviço
              </th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Status de Conexão
              </th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {instances.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500 italic text-sm font-medium">
                  Nenhuma instância encontrada
                </td>
              </tr>
            ) : (
              instances.map((instance) => {
                const instanceName = instance.instanceName || instance.instance?.instanceName || instance.id || 'unknown';
                const status = instance.instance?.state || instance.status || 'unknown';

                if (!instanceName || instanceName === 'unknown') {
                  return null;
                }

                return (
                  <tr key={instanceName} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                      {instanceName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full shadow-sm border ${
                          status === 'open'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800'
                            : status === 'connecting'
                            ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800'
                            : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                        }`}
                      >
                        {status === 'open' ? 'Conectado' : status === 'connecting' ? 'Conectando' : 'Desconectado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(instanceName)}
                        disabled={deletingId === instanceName}
                        className="rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 shadow-sm hover:shadow"
                        aria-label="Excluir instância"
                      >
                        {deletingId === instanceName ? (
                          <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              }).filter(Boolean)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

