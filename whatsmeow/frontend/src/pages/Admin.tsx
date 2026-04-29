import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, Plus, Edit } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
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
import { Sherlock } from './Sherlock';
import { Leads } from './Leads';
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
                      location.pathname === '/admin/sherlock' ? 'sherlock' :
                      location.pathname === '/admin/leads' ? 'leads' :
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

  if (currentPage === 'sherlock') {
    return (
      <div className="max-w-7xl mx-auto">
        <Sherlock onViewLeads={(scrape) => navigate(`/admin/leads?scrape_id=${scrape.id}`)} />
      </div>
    );
  }

  if (currentPage === 'leads') {
    return (
      <div className="max-w-7xl mx-auto">
        <Leads />
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
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">Gestão de Colaboradores</h1>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Administre os acessos e permissões da sua equipe.
            </p>
          </div>

          <Button 
            onClick={() => {
              setEditingUser(null);
              setShowUserForm(true);
            }}
            className="rounded-xl h-11 px-6 bg-gradient-to-r from-emerald-500 to-green-600 border-none shadow-lg shadow-emerald-500/20"
          >
            <Plus size={18} className="mr-2" />
            Criar Novo Usuário
          </Button>
        </div>

        <div className="mt-2">
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
                toast.success('Usuário removido do sistema.');
                fetchUsers();
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Erro ao remover colaborador.');
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
          title={editingUser ? 'Ajustar Colaborador' : 'Novo Colaborador'}
          size="lg"
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
                  toast.success('Perfil atualizado com sucesso.');
                } else {
                  await adminService.createUser(userData as any);
                  toast.success('Novo acesso liberado.');
                }
                setShowUserForm(false);
                setEditingUser(null);
                fetchUsers();
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Falha na sincronização dos dados.');
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

  // Página de Perfil da Empresa
  if (currentPage === 'company') {
    if (loading && !company) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="animate-spin text-emerald-500 mx-auto mb-4" size={48} />
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Sincronizando Dados Corporativos...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">Unidade de Negócio</h1>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Gerencie a identidade e as configurações da sua organização.
            </p>
          </div>

          <Button 
            onClick={() => setShowCompanyForm(true)}
            className="rounded-xl h-11 px-6 bg-gradient-to-r from-emerald-500 to-green-600 border-none shadow-lg shadow-emerald-500/20"
          >
            <Edit size={18} className="mr-2" />
            Editar Perfil
          </Button>
        </div>

        <div className="mt-2">
          {company ? (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/5 to-green-600/5 rounded-full -mr-32 -mt-32 blur-3xl" />
              
              <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Nome Fantasia</label>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{company.nome}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Documento Principal</label>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{company.cnpj || '—'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Status da Conta</label>
                  <div>
                    <span className={`inline-flex px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full shadow-sm border ${
                      company.ativo
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800'
                        : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800'
                    }`}>
                      {company.ativo ? 'Operação Ativa' : 'Acesso Suspenso'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">E-mail de Contato</label>
                  <p className="text-base font-medium text-gray-700 dark:text-gray-300">{company.email || '—'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Telefone Corporativo</label>
                  <p className="text-base font-medium text-gray-700 dark:text-gray-300">{company.telefone || '—'}</p>
                </div>
                <div className="md:col-span-2 lg:col-span-3 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Sede Principal</label>
                  <p className="text-base font-medium text-gray-700 dark:text-gray-300">{company.endereco || '—'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-12 text-center">
              <p className="text-gray-400 font-medium italic mb-6">Nenhuma organização vinculada ao seu perfil.</p>
              <Button onClick={() => setShowCompanyForm(true)} className="rounded-xl">
                Registrar Minha Empresa
              </Button>
            </div>
          )}
        </div>

        <Modal
          isOpen={showCompanyForm}
          onClose={() => setShowCompanyForm(false)}
          title={company ? 'Ajustar Dados da Empresa' : 'Registro de Empresa'}
          size="lg"
        >
          <CompanyForm
            company={company}
            onSubmit={async (companyData) => {
              try {
                await adminService.updateCompany(companyData);
                toast.success('Perfil corporativo atualizado.');
                setShowCompanyForm(false);
                fetchCompany();
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Falha na atualização.');
                throw error;
              }
            }}
            onSuccess={() => {
              setShowCompanyForm(false);
              fetchCompany();
            }}
            onCancel={() => setShowCompanyForm(false)}
          />
        </Modal>
      </div>
    );
  }

  // Fallback (n?o deveria acontecer)
  return null;
}
