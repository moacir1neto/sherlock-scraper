import { useState } from 'react';
import { Edit, Trash2, Plus, Users } from 'lucide-react';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { UserForm } from './UserForm';
import { User } from '../../types';
import { adminService } from '../../services/admin';
import { superAdminService } from '../../services/superAdmin';
import { toast } from 'react-hot-toast';
import { ConfirmDialog } from '../../utils/sweetalert';

interface UserTableProps {
  users: User[];
  companies: Array<{ id: string; nome: string }>;
  onRefresh: () => void;
  onEdit?: (user: User) => void;
  onDelete?: (id: string) => Promise<void>;
  showCreateButton?: boolean;
  onCreate?: () => void;
  /** Quando true, usa endpoints /super-admin/users; caso contrário /admin/users */
  useSuperAdminApi?: boolean;
}

export function UserTable({ 
  users, 
  companies, 
  onRefresh, 
  onEdit,
  onDelete,
  showCreateButton = true,
  onCreate,
  useSuperAdminApi = false,
}: UserTableProps) {
  const userApi = useSuperAdminApi ? superAdminService : adminService;
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleEdit = (user: User) => {
    if (onEdit) {
      onEdit(user);
    } else {
      setEditingUser(user);
      setShowForm(true);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await ConfirmDialog.fire({
      title: 'Excluir Usuário?',
      text: 'Tem certeza que deseja remover este acesso? Esta ação não pode ser desfeita.',
      icon: 'warning',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) {
      return;
    }

    if (onDelete) {
      try {
        setDeletingId(id);
        await onDelete(id);
        toast.success('Usuário excluído com sucesso!');
        onRefresh();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Erro ao excluir usuário');
      } finally {
        setDeletingId(null);
      }
    } else {
      try {
        setDeletingId(id);
        await userApi.deleteUser(id);
        toast.success('Usuário excluído com sucesso!');
        onRefresh();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Erro ao excluir usuário');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    onRefresh();
  };

  const getCompanyName = (companyId?: string) => {
    if (!companyId) return '-';
    const company = companies.find((c) => c.id === companyId);
    return company?.nome || '-';
  };

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg overflow-hidden">
      <div className="p-6 border-b border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
            <Users size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white leading-tight">Usuários</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
              Gerenciamento de acessos ({users.length})
            </p>
          </div>
        </div>
        {showCreateButton && (
          <Button onClick={() => onCreate ? onCreate() : setShowForm(true)} className="rounded-xl">
            <Plus size={18} className="mr-2" />
            Novo Usuário
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50/50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Nome
              </th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Email
              </th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Role
              </th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Empresa
              </th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500 italic text-sm font-medium">
                  Nenhum usuário cadastrado
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                    {user.nome}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full shadow-sm ${
                        user.role === 'super_admin'
                          ? 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800'
                          : user.role === 'admin'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                      }`}
                    >
                      {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium italic">
                    {getCompanyName(user.company_id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(user)}
                        className="rounded-lg hover:bg-white dark:hover:bg-gray-700 shadow-sm hover:shadow"
                        aria-label="Editar usuário"
                      >
                        <Edit size={14} className="text-emerald-600 dark:text-emerald-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(user.id)}
                        disabled={deletingId === user.id}
                        className="rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 shadow-sm hover:shadow"
                        aria-label="Excluir usuário"
                      >
                        {deletingId === user.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showForm}
        onClose={handleFormClose}
        title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
        size="lg"
      >
        <UserForm
          user={editingUser}
          companies={companies}
          onSuccess={handleFormSuccess}
          onCancel={handleFormClose}
          useSuperAdminApi={useSuperAdminApi}
        />
      </Modal>
    </div>
  );
}

