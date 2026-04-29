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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <Server className="text-primary-600" size={24} />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Instâncias</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">({instances.length})</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Nome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {instances.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
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
                  <tr key={instanceName} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {instanceName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          status === 'open'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : status === 'connecting'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {status === 'open' ? 'Conectado' : status === 'connecting' ? 'Conectando' : 'Desconectado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(instanceName)}
                        disabled={deletingId === instanceName}
                      >
                        <Trash2 size={16} />
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

