import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { UserTable } from '../components/super-admin/UserTable';
import { UserForm } from '../components/super-admin/UserForm';
import { CompanyForm } from '../components/super-admin/CompanyForm';
import { WebhookConfig } from './WebhookConfig';
import { WebhookLogs } from './WebhookLogs';
import { ApiDocs } from './ApiDocs';
import { Tags } from './Tags';
import { Sectors } from './Sectors';
import { Settings } from './Settings';
import { QuickReplies } from './QuickReplies';
import { Scheduling } from './Scheduling';
import { Kanban } from './Kanban';
import { Flows } from './Flows';
import { FlowEditor } from './FlowEditor';
import { adminService } from '../services/admin';
import { User, Company } from '../types';
import { toast } from 'react-hot-toast';

export function Admin() {
  const location = useLocation();
  const navigate = useNavigate();
  const { flowId } = useParams<{ flowId?: string }>();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Determinar qual p?gina mostrar baseado na rota
  const currentPage = location.pathname === '/admin/company' ? 'company' :
                      location.pathname === '/admin/users' ? 'users' :
                      location.pathname === '/admin/webhook' ? 'webhook' :
                      location.pathname === '/admin/webhook-logs' ? 'webhook-logs' :
                      location.pathname === '/admin/api' ? 'api' :
                      location.pathname === '/admin/tags' ? 'tags' :
                      location.pathname === '/admin/sectors' ? 'sectors' :
                      location.pathname === '/admin/settings' ? 'settings' :
                      location.pathname === '/admin/quick-replies' ? 'quick-replies' :
                      location.pathname === '/admin/scheduling' ? 'scheduling' :
                      location.pathname === '/admin/kanban' ? 'kanban' :
                      location.pathname === '/admin/flows' ? 'flows' :
                      'users';

  // Redirecionar /admin para /admin/users
  useEffect(() => {
    if (location.pathname === '/admin') {
      navigate('/admin/users', { replace: true });
    }
  }, [location.pathname, navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersData = await adminService.listUsers().catch(() => []);
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Erro ao carregar usu?rios';
      toast.error(errorMessage);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompany = async () => {
    try {
      setLoading(true);
      console.log('Fetching company data...');
      const companyData = await adminService.getCompany();
      console.log('Company data received:', companyData);
      setCompany(companyData);
    } catch (error: any) {
      console.error('Error fetching company:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Erro ao carregar dados da empresa';
      toast.error(errorMessage);
      setCompany(null);
    } finally {
      setLoading(false);
    }
  };

  // Carregar empresa sempre que necess?rio (para usar no UserForm)
  useEffect(() => {
    if (!company && user?.company_id) {
      fetchCompany();
    }
  }, [user?.company_id]);

  useEffect(() => {
    if (currentPage === 'users') {
      fetchUsers();
    } else if (currentPage === 'company') {
      fetchCompany();
    }
  }, [currentPage]);

  // P?gina de Webhook (configura??o)
  if (currentPage === 'webhook') {
    return (
      <div className="max-w-7xl mx-auto">
        <WebhookConfig />
      </div>
    );
  }

  // P?gina de Logs de Webhook
  if (currentPage === 'webhook-logs') {
    return (
      <div className="max-w-7xl mx-auto">
        <WebhookLogs />
      </div>
    );
  }

  // P?gina de documenta??o da API
  if (currentPage === 'api') {
    return (
      <div className="max-w-7xl mx-auto">
        <ApiDocs />
      </div>
    );
  }

  // P?gina de Setores
  if (currentPage === 'sectors') {
    return (
      <div className="max-w-7xl mx-auto">
        <Sectors />
      </div>
    );
  }
  // Página de Tags
  if (currentPage === 'tags') {
    return (
      <div className="max-w-7xl mx-auto">
        <Tags />
      </div>
    );
  }

  // Página de Configurações (notificações, som)
  if (currentPage === 'settings') {
    return (
      <div className="max-w-7xl mx-auto">
        <Settings />
      </div>
    );
  }

  if (currentPage === 'quick-replies') {
    return (
      <div className="max-w-7xl mx-auto">
        <QuickReplies />
      </div>
    );
  }
  if (currentPage === 'scheduling') {
    return (
      <div className="max-w-7xl mx-auto">
        <Scheduling />
      </div>
    );
  }
  if (currentPage === 'kanban') {
    return (
      <div className="max-w-7xl mx-auto">
        <Kanban />
      </div>
    );
  }
  if (currentPage === 'flows' || (location.pathname.startsWith('/admin/flows/') && flowId)) {
    if (flowId) {
      return (
        <div className="max-w-7xl mx-auto">
          <FlowEditor flowId={flowId} />
        </div>
      );
    }
    return (
      <div className="max-w-7xl mx-auto">
        <Flows />
      </div>
    );
  }

  // P?gina de Usu?rios
  if (currentPage === 'users') {
    if (loading && users.length === 0) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <RefreshCw className="animate-spin text-primary-600 mx-auto mb-4" size={48} />
            <p className="text-gray-600 dark:text-gray-400">Carregando usu?rios...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usu?rios da Empresa</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Gerencie os usu?rios da sua empresa
          </p>
        </div>

        <div className="mb-6 flex items-center justify-end">
          <Button onClick={() => {
            setEditingUser(null);
            setShowUserForm(true);
          }}>
            Criar Usu?rio
          </Button>
        </div>

        <div className="mt-6">
          <UserTable
            users={users}
            companies={[]}
            onRefresh={fetchUsers}
            onEdit={(user) => {
              setEditingUser(user);
              setShowUserForm(true);
            }}
            onDelete={async (id) => {
              try {
                await adminService.deleteUser(id);
                toast.success('Usu?rio exclu?do com sucesso!');
                fetchUsers();
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Erro ao excluir usu?rio');
              }
            }}
            onCreate={() => {
              setEditingUser(null);
              setShowUserForm(true);
            }}
          />
        </div>

        <Modal
          isOpen={showUserForm}
          onClose={() => {
            setShowUserForm(false);
            setEditingUser(null);
          }}
          title={editingUser ? 'Editar Usu?rio' : 'Criar Usu?rio'}
          size="md"
        >
          <UserForm
            user={editingUser}
            companies={company ? [{ id: company.id, nome: company.nome }] : []}
            isAdmin={true}
            defaultCompanyId={company?.id}
            onSubmit={async (userData) => {
              try {
                if (editingUser) {
                  await adminService.updateUser(editingUser.id, userData);
                  toast.success('Usu?rio atualizado com sucesso!');
                } else {
                  await adminService.createUser(userData as any);
                  toast.success('Usu?rio criado com sucesso!');
                }
                setShowUserForm(false);
                setEditingUser(null);
                fetchUsers();
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Erro ao salvar usu?rio');
                throw error;
              }
            }}
            onSuccess={() => {
              setShowUserForm(false);
              setEditingUser(null);
              fetchUsers();
            }}
            onCancel={() => {
              setShowUserForm(false);
              setEditingUser(null);
            }}
          />
        </Modal>
      </div>
    );
  }

  // P?gina de Perfil da Empresa
  if (currentPage === 'company') {
    if (loading && !company) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <RefreshCw className="animate-spin text-primary-600 mx-auto mb-4" size={48} />
            <p className="text-gray-600 dark:text-gray-400">Carregando dados da empresa...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Perfil da Empresa</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Edite os dados da sua empresa
          </p>
        </div>

        <div className="mt-6">
          {company ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Dados da Empresa
                </h2>
                <Button onClick={() => setShowCompanyForm(true)}>
                  Editar Empresa
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nome
                  </label>
                  <p className="text-gray-900 dark:text-white">{company.nome}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CNPJ
                  </label>
                  <p className="text-gray-900 dark:text-white">{company.cnpj || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <p className="text-gray-900 dark:text-white">{company.email || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Telefone
                  </label>
                  <p className="text-gray-900 dark:text-white">{company.telefone || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Endere?o
                  </label>
                  <p className="text-gray-900 dark:text-white">{company.endereco || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    company.ativo
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {company.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400 mb-4">Nenhuma empresa encontrada</p>
              <Button onClick={() => setShowCompanyForm(true)}>
                Criar Empresa
              </Button>
            </div>
          )}
        </div>

        <Modal
          isOpen={showCompanyForm}
          onClose={() => {
            setShowCompanyForm(false);
          }}
          title={company ? 'Editar Empresa' : 'Criar Empresa'}
          size="md"
        >
          <CompanyForm
            company={company}
            onSubmit={async (companyData) => {
              try {
                await adminService.updateCompany(companyData);
                toast.success('Empresa atualizada com sucesso!');
                setShowCompanyForm(false);
                fetchCompany();
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Erro ao salvar empresa');
                throw error;
              }
            }}
            onSuccess={() => {
              setShowCompanyForm(false);
              fetchCompany();
            }}
            onCancel={() => {
              setShowCompanyForm(false);
            }}
          />
        </Modal>
      </div>
    );
  }

  // Fallback (n?o deveria acontecer)
  return null;
}
