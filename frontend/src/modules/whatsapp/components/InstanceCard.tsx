import { useState, useEffect } from 'react';
import { MessageSquare, Trash2, QrCode, LogOut, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { instanceService } from '../services/api';
import { userService } from '../services/user';
import { QRCodeModal } from './QRCodeModal';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Instance } from '../types';
import { User } from '../types';

interface InstanceCardProps {
  instance: Instance;
  onUpdate: () => void;
  onSelect?: (instanceId: string) => void;
}

export function InstanceCard({ instance, onUpdate, onSelect }: InstanceCardProps) {
  const { user } = useAuth();
  const [showQR, setShowQR] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [instanceUserIds, setInstanceUserIds] = useState<string[]>([]);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const canManageAccess = user?.role === 'admin' || user?.role === 'super_admin';

  const handleConnect = async () => {
    try {
      setLoading('connect');
      // Primeiro tenta conectar para iniciar o processo
      try {
        await instanceService.connect(instance.instanceName);
      } catch (connectError: any) {
        // Se der erro 404, a instância pode não existir ainda
        if (connectError.response?.status === 404) {
          toast.error('Instância não encontrada. Recarregue a página e tente novamente.');
          return;
        }
        // Outros erros podem ser ignorados, vamos tentar obter o QR code mesmo assim
      }
      setShowQR(true);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Erro ao iniciar conexão';
      toast.error(errorMessage);
    } finally {
      setLoading(null);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Tem certeza que deseja desconectar esta instância?')) return;
    
    try {
      setLoading('logout');
      await instanceService.logout(instance.instanceName);
      toast.success('Desconectado com sucesso');
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao desconectar');
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja deletar esta instância? Esta ação não pode ser desfeita.')) return;
    
    try {
      setLoading('delete');
      await instanceService.delete(instance.instanceName);
      toast.success('Instância deletada com sucesso');
      onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao deletar');
    } finally {
      setLoading(null);
    }
  };

  const statusColors = {
    open: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    close: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    connecting: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
  };

  const statusLabels = {
    open: 'Conectado',
    close: 'Desconectado',
    connecting: 'Conectando...',
  };

  useEffect(() => {
    if (showSettings && canManageAccess) {
      setDisplayName((instance as any).displayName || instance.instanceName || '');
      instanceService.getInstanceUsers(instance.instanceName).then((r) => setInstanceUserIds(r.user_ids || [])).catch(() => setInstanceUserIds([]));
      userService.list().then(setCompanyUsers).catch(() => setCompanyUsers([]));
    }
  }, [showSettings, canManageAccess, instance.instanceName, (instance as any).displayName]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await instanceService.update(instance.instanceName, { displayName: displayName.trim() || undefined });
      await instanceService.setInstanceUsers(instance.instanceName, instanceUserIds);
      toast.success('Configurações salvas');
      setShowSettings(false);
      onUpdate();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar configurações');
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleUserForInstance = (userId: string) => {
    setInstanceUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const displayTitle = (instance as any).displayName || instance.instanceName;

  return (
    <>
      <motion.div
        whileHover={{ y: -2 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-all duration-200"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {displayTitle}
              </h3>
              {canManageAccess && (
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Configurações"
                >
                  <Settings size={18} />
                </button>
              )}
            </div>
            <span
              className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                statusColors[instance.status || 'close']
              }`}
            >
              {statusLabels[instance.status || 'close']}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {instance.status !== 'open' && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleConnect}
              disabled={loading !== null}
            >
              <QrCode size={16} className="mr-1" />
              Conectar
            </Button>
          )}

          {instance.status === 'open' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onSelect?.(instance.instanceName)}
              >
                <MessageSquare size={16} className="mr-1" />
                Mensagens
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={loading !== null}
              >
                <LogOut size={16} className="mr-1" />
                Desconectar
              </Button>
            </>
          )}

          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            disabled={loading !== null}
          >
            <Trash2 size={16} className="mr-1" />
            Deletar
          </Button>
        </div>
      </motion.div>

      <QRCodeModal
        isOpen={showQR}
        onClose={() => {
          setShowQR(false);
          // Força atualização após fechar o modal
          setTimeout(() => {
            onUpdate();
          }, 500);
        }}
        instanceId={instance.instanceName}
        onConnected={async () => {
          await onUpdate();
          setTimeout(() => onUpdate(), 1000);
        }}
      />

      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Configurações da instância"
      >
        <div className="space-y-4">
          <Input
            label="Nome de exibição"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={instance.instanceName}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Usuários com acesso
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Apenas estes usuários (e admins) poderão ver e usar esta instância.
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-600 p-2 space-y-1">
              {companyUsers.length === 0 && <p className="text-sm text-gray-500 py-2">Nenhum usuário da empresa.</p>}
              {companyUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-2 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={instanceUserIds.includes(u.id)}
                    onChange={() => toggleUserForInstance(u.id)}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">{u.nome || u.email}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowSettings(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

