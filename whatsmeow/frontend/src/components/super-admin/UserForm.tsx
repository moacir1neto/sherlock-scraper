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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Nome completo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          placeholder="Ex: João Silva"
        />

        <Input
          label="E-mail de acesso"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="usuario@whatsmeow.com"
        />
      </div>

      <Input
        label={user ? 'Nova Senha (deixe em branco para manter)' : 'Senha de acesso'}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required={!user}
        placeholder="••••••••"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
            Nível de Acesso
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'super_admin' | 'admin' | 'user')}
            className="w-full px-4 py-2.5 border border-gray-200/60 dark:border-gray-700/60 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm cursor-pointer"
            required
          >
            <option value="user">Usuário Comum</option>
            <option value="admin">Administrador da Empresa</option>
            {!isAdmin && <option value="super_admin">Super Administrador</option>}
          </select>
        </div>

        {!isAdmin && (
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
              Vincular Empresa
            </label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200/60 dark:border-gray-700/60 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm cursor-pointer"
            >
              <option value="">Nenhuma empresa vinculada</option>
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
            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
              Empresa Vinculada
            </label>
            <div className="w-full px-4 py-2.5 border border-gray-200/60 dark:border-gray-700/60 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-medium cursor-not-allowed italic">
              {companies.find(c => c.id === defaultCompanyId)?.nome || 'Sua Empresa'}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 ml-1">
              * Vinculado automaticamente à sua unidade de negócio.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700/50">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={onCancel}
          className="rounded-xl px-6"
        >
          Cancelar
        </Button>
        <Button 
          type="submit" 
          loading={loading}
          className="rounded-xl px-8 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 border-none shadow-lg shadow-emerald-500/20"
        >
          {user ? 'Salvar Alterações' : 'Criar Novo Usuário'}
        </Button>
      </div>
    </form>
  );
}

