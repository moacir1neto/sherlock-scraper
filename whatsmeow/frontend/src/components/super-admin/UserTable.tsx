import { useState } from 'react';
import { Edit, Trash2, Plus, Users } from 'lucide-react';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { UserForm } from './UserForm';
import { User } from '../../types';
import { adminService } from '../../services/admin';
import { superAdminService } from '../../services/superAdmin';
import { toast } from 'react-hot-toast';

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
    if (!confirm('Tem certeza que deseja excluir este usuário?')) {
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="text-primary-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Usuários</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">({users.length})</span>
        </div>
        {showCreateButton && (
          <Button onClick={() => onCreate ? onCreate() : setShowForm(true)}>
            <Plus size={20} className="mr-2" />
            Novo Usuário
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Nome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Empresa
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  Nenhum usuário cadastrado
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {user.nome}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'super_admin'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                          : user.role === 'admin'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}
                    >
                      {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {getCompanyName(user.company_id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(user)}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(user.id)}
                        disabled={deletingId === user.id}
                      >
                        <Trash2 size={16} />
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

