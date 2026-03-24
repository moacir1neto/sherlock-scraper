import { useState, useEffect } from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { User } from '../../types';
import { adminService } from '../../services/admin';
import { superAdminService } from '../../services/superAdmin';
import { toast } from 'react-hot-toast';

interface UserFormProps {
  user?: User | null;
  companies: Array<{ id: string; nome: string }>;
  onSuccess: () => void;
  onCancel: () => void;
  onSubmit?: (data: any) => Promise<void>;
  isAdmin?: boolean; // Se true, oculta campo empresa e remove super_admin do role
  defaultCompanyId?: string; // ID da empresa padrão (para admin)
  /** Quando true, usa endpoints /super-admin/users */
  useSuperAdminApi?: boolean;
}

export function UserForm({ user, companies, onSuccess, onCancel, onSubmit, isAdmin = false, defaultCompanyId, useSuperAdminApi = false }: UserFormProps) {
  const userApi = useSuperAdminApi ? superAdminService : adminService;
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'super_admin' | 'admin' | 'user'>('user');
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setNome(user.nome);
      setEmail(user.email);
      setPassword('');
      setRole(user.role);
      setCompanyId(user.company_id || '');
    } else {
      // Reset form when creating new user
      setNome('');
      setEmail('');
      setPassword('');
      setRole('user');
      // Se for admin, usar company_id padrão
      setCompanyId(isAdmin && defaultCompanyId ? defaultCompanyId : '');
    }
  }, [user, isAdmin, defaultCompanyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data: any = {
        nome,
        email,
        role,
        // Se for admin, sempre usar defaultCompanyId (empresa do admin)
        company_id: (isAdmin && defaultCompanyId) ? defaultCompanyId : (companyId || undefined),
      };

      if (onSubmit) {
        // Use custom onSubmit if provided
        if (user) {
          if (password) {
            data.password = password;
          }
        } else {
          if (!password) {
            toast.error('Senha é obrigatória para novos usuários');
            setLoading(false);
            return;
          }
          data.password = password;
        }
        await onSubmit(data);
      } else {
        // Default behavior
        if (user) {
          if (password) {
            data.password = password;
          }
          await userApi.updateUser(user.id, data);
          toast.success('Usuário atualizado com sucesso!');
        } else {
          if (!password) {
            toast.error('Senha é obrigatória para novos usuários');
            setLoading(false);
            return;
          }
          data.password = password;
          await userApi.createUser(data);
          toast.success('Usuário criado com sucesso!');
        }
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar usuário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        required
        placeholder="Nome completo"
      />

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="usuario@email.com"
      />

      <Input
        label={user ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required={!user}
        placeholder="••••••••"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Role
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'super_admin' | 'admin' | 'user')}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          required
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
          {!isAdmin && <option value="super_admin">Super Admin</option>}
        </select>
      </div>

      {!isAdmin && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Empresa
          </label>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Nenhuma</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.nome}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {isAdmin && defaultCompanyId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Empresa
          </label>
          <input
            type="text"
            value={companies.find(c => c.id === defaultCompanyId)?.nome || 'Empresa'}
            disabled
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Usuários criados serão automaticamente vinculados à sua empresa
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : user ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
}

