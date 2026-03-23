import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, Settings, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CompanyTable } from '../components/super-admin/CompanyTable';
import { UserTable } from '../components/super-admin/UserTable';
import { InstanceTable } from '../components/super-admin/InstanceTable';
import { companyService } from '../services/company';
import { superAdminService } from '../services/superAdmin';
import { Company, User, SuperAdminInstance } from '../types';
import { toast } from 'react-hot-toast';

type SuperAdminTab = 'dashboard' | 'companies' | 'users' | 'instances';

export function SuperAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [instances, setInstances] = useState<SuperAdminInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const getActiveTab = (): SuperAdminTab => {
    if (location.pathname.endsWith('/users')) return 'users';
    if (location.pathname.endsWith('/instances')) return 'instances';
    // Default para empresas (inclui /super-admin e /super-admin/companies)
    return 'companies';
  };

  const activeTab: SuperAdminTab = getActiveTab();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [companiesData, usersData, instancesData] = await Promise.all([
        companyService.list().catch(() => []),
        superAdminService.listUsers().catch(() => []),
        superAdminService.listInstances().catch(() => []),
      ]);
      setCompanies(Array.isArray(companiesData) ? companiesData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setInstances(Array.isArray(instancesData) ? instancesData : []);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Erro ao carregar dados';
      toast.error(errorMessage);
      // Garantir que os arrays nunca sejam null/undefined
      setCompanies([]);
      setUsers([]);
      setInstances([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="animate-spin text-primary-600 mx-auto mb-4" size={48} />
          <p className="text-gray-600 dark:text-gray-400">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Painel Super Admin</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Bem-vindo, {user?.nome} ({user?.email})
        </p>
      </div>
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => navigate('/dashboard')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'dashboard'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <LayoutDashboard size={18} />
                Dashboard
              </button>
              <button
                onClick={() => navigate('/super-admin/companies')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'companies'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Building2 size={18} />
                Empresas ({companies?.length || 0})
              </button>
              <button
                onClick={() => navigate('/super-admin/users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'users'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Users size={18} />
                Usuários ({users?.length || 0})
              </button>
              <button
                onClick={() => navigate('/super-admin/instances')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'instances'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Settings size={18} />
                Instâncias ({instances?.length || 0})
              </button>
            </nav>
          </div>
        </div>

        <div className="mt-6">
          {activeTab === 'dashboard' && (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">Redirecionando para Dashboard...</p>
            </div>
          )}
          {activeTab === 'companies' && (
            <CompanyTable companies={companies} onRefresh={fetchData} />
          )}
          {activeTab === 'users' && (
            <UserTable
              users={users}
              companies={companies.map((c) => ({ id: c.id, nome: c.nome }))}
              onRefresh={fetchData}
              useSuperAdminApi
            />
          )}
          {activeTab === 'instances' && (
            <InstanceTable instances={instances} onRefresh={fetchData} />
          )}
        </div>
    </div>
  );
}

