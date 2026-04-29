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
import { useAuth } from '../contexts/AuthContext';
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

  const handleConnect = () => {
    setShowQR(true);
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
        whileHover={{ y: -4, shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
        className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg p-6 transition-all duration-300 group"
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0 group-hover:scale-110 transition-transform duration-300">
              <QrCode size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">
                  {displayTitle}
                </h3>
                {canManageAccess && (
                  <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
                    title="Configurações da Instância"
                    aria-label="Configurações da Instância"
                  >
                    <Settings size={16} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`w-2 h-2 rounded-full animate-pulse ${
                  instance.status === 'open' ? 'bg-emerald-500' : instance.status === 'connecting' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {statusLabels[instance.status || 'close']}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {instance.status !== 'open' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleConnect}
              disabled={loading !== null}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 border-none shadow-lg shadow-emerald-500/20 h-10 col-span-2"
              aria-label="Conectar instância via QR Code"
            >
              <QrCode size={16} className="mr-2" />
              Conectar Agora
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onSelect?.(instance.instanceName)}
                className="rounded-xl bg-gray-100 dark:bg-gray-700 h-10 font-bold text-xs uppercase tracking-wider"
                aria-label="Abrir chat para esta instância"
              >
                <MessageSquare size={14} className="mr-2" />
                Abrir Chat
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={loading !== null}
                className="rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 text-red-500 h-10 font-bold text-xs uppercase tracking-wider"
                aria-label="Desconectar instância"
              >
                <LogOut size={14} className="mr-2" />
                Sair
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={loading !== null}
            className="rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 h-10 text-gray-400 font-bold text-xs uppercase tracking-wider col-span-2 border border-gray-100 dark:border-gray-800"
            aria-label="Excluir instância permanentemente"
          >
            <Trash2 size={14} className="mr-2" />
            Deletar Instância
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

