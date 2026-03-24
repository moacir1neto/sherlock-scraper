import { useState, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { InstanceCard } from '../components/InstanceCard';
import { Modal } from '../components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { instanceService } from '../services/api';
import { toast } from 'react-hot-toast';
import { Instance } from '../types';
import { useRealtime } from '../hooks/useRealtime';

export function Instances() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [creating, setCreating] = useState(false);
  
  // Esconder botões de criar instância para super_admin e user
  // Apenas admin pode criar instâncias
  const hideCreateButtons = user?.role === 'super_admin' || user?.role === 'user';

  const fetchInstances = async () => {
    try {
      console.log('📥 Buscando instâncias...');
      const data = await instanceService.list();
      console.log('📦 Dados recebidos da API:', data);
      
      let instancesList: Instance[] = [];
      
      if (Array.isArray(data)) {
        // Se for array direto, processa cada item
        instancesList = data.map((item: any) => {
          // Formato pode ser: { instance: {...}, instanceName: "..." } ou direto
          if (item.instance) {
            return {
              instanceName: item.instanceName || item.instance.id || item.instance.ID || '',
              status: item.instance.status || 'close',
              ...item.instance,
            };
          } else if (item.instanceName || item.id || item.ID) {
            return {
              instanceName: item.instanceName || item.id || item.ID || '',
              status: item.status || 'close',
              ...item,
            };
          }
          return item;
        }).filter((item: any) => item.instanceName || item.id || item.ID);
      } else if (data && typeof data === 'object') {
        // Se retornar um objeto, tenta extrair array de instâncias
        const instancesArray = (data as any).instances || (data as any).data || [];
        if (Array.isArray(instancesArray)) {
          instancesList = instancesArray.map((item: any) => ({
            instanceName: item.instanceName || item.id || item.ID || '',
            status: item.status || 'close',
            ...item,
          }));
        }
      }
      
      console.log('📋 Instâncias processadas:', instancesList.length, instancesList);
      
      // Para cada instância, verifica o status atualizado
      const instancesWithStatus: Instance[] = await Promise.all(
        instancesList.map(async (instance: any): Promise<Instance> => {
          const instanceId = instance.instanceName || instance.id || instance.ID;
          if (!instanceId) {
            console.warn('Instância sem ID:', instance);
            return instance;
          }
          
          try {
            const statusData = await instanceService.status(instanceId);
            const state = statusData.instance?.state || statusData.status || instance.status || 'close';
            const normalizedStatus: 'open' | 'close' | 'connecting' = 
              state === 'open' ? 'open' : 
              state === 'connecting' ? 'connecting' : 
              'close';
            return {
              ...instance,
              instanceName: instanceId,
              status: normalizedStatus,
            };
          } catch (error) {
            // Se não conseguir obter status, mantém o status original
            console.warn(`Não foi possível obter status para ${instanceId}:`, error);
            return {
              ...instance,
              instanceName: instanceId,
              status: instance.status || 'close',
            };
          }
        })
      );
      
      console.log('✅ Instâncias finais:', instancesWithStatus.length, instancesWithStatus);
      setInstances(instancesWithStatus);
    } catch (error: any) {
      console.error('❌ Erro ao carregar instâncias:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Erro ao carregar instâncias';
      // Não mostra toast de erro se for apenas um problema de rede temporário
      if (!error.response || error.response.status !== 500) {
        toast.error(errorMessage);
      }
      // Mantém as instâncias anteriores em caso de erro temporário
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  // Polling para atualizar status das instâncias
  useRealtime(fetchInstances, 3000, true);

  const handleCreate = async () => {
    const trimmedName = newInstanceName.trim();
    
    if (!trimmedName) {
      toast.error('Digite um nome para a instância');
      return;
    }

    // Validação de nome (sem espaços, apenas letras, números, hífen e underscore)
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
      toast.error('O nome da instância deve conter apenas letras, números, hífen (-) ou underscore (_)');
      return;
    }

    if (trimmedName.length < 3) {
      toast.error('O nome da instância deve ter pelo menos 3 caracteres');
      return;
    }

    if (trimmedName.length > 50) {
      toast.error('O nome da instância deve ter no máximo 50 caracteres');
      return;
    }

    // Verifica se já existe uma instância com esse nome
    if (instances.some(inst => inst.instanceName === trimmedName)) {
      toast.error('Já existe uma instância com esse nome');
      return;
    }

    try {
      setCreating(true);
      console.log('🔄 Tentando criar instância:', {
        name: trimmedName,
        user: user?.email,
        role: user?.role,
        token: localStorage.getItem('token') ? 'EXISTS' : 'MISSING',
      });
      
      const result = await instanceService.create(trimmedName);
      console.log('✅ Instância criada com sucesso:', result);
      
      toast.success('Instância criada com sucesso!');
      setShowCreateModal(false);
      setNewInstanceName('');
      // Aguarda um pouco antes de atualizar para garantir que a instância foi criada e salva
      setTimeout(() => {
        fetchInstances();
      }, 1000);
    } catch (error: any) {
      console.error('❌ Erro ao criar instância - DETALHES:', {
        error,
        message: error.message,
        response: error.response,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: error.config,
        user: {
          email: user?.email,
          role: user?.role,
          id: user?.id,
        },
        token: localStorage.getItem('token') ? 'EXISTS' : 'MISSING',
      });
      
      const errorMessage = error.response?.data?.message || error.message || 'Erro ao criar instância';
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="animate-spin text-primary-600 mx-auto mb-4" size={48} />
          <p className="text-gray-600">Carregando instâncias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Instâncias WhatsApp</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gerencie suas conexões do WhatsApp</p>
        </div>
        {!hideCreateButtons && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={20} className="mr-2" />
            Nova Instância
          </Button>
        )}
      </motion.div>

        {instances.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center"
          >
            <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
              Nenhuma instância criada ainda
            </p>
            {!hideCreateButtons && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus size={20} className="mr-2" />
                Criar Primeira Instância
              </Button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instances.map((instance, index) => (
              <motion.div
                key={instance.instanceName}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <InstanceCard
                  instance={instance}
                  onUpdate={fetchInstances}
                  onSelect={(instanceId) => navigate(`/messages/${instanceId}`)}
                />
              </motion.div>
            ))}
          </div>
        )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewInstanceName('');
        }}
        title="Criar Nova Instância"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Nome da Instância"
            placeholder="ex: minha-instancia"
            value={newInstanceName}
            onChange={(e) => setNewInstanceName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
            validateOnBlur
            validator={(value) => {
              if (!value.trim()) {
                return { valid: false, error: 'Nome é obrigatório' };
              }
              if (!/^[a-zA-Z0-9_-]+$/.test(value.trim())) {
                return { valid: false, error: 'Use apenas letras, números, hífen (-) ou underscore (_)' };
              }
              if (value.trim().length < 3) {
                return { valid: false, error: 'Mínimo de 3 caracteres' };
              }
              if (value.trim().length > 50) {
                return { valid: false, error: 'Máximo de 50 caracteres' };
              }
              return { valid: true };
            }}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateModal(false);
                setNewInstanceName('');
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Criando...' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

