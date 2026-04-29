import { useState } from 'react';
import { Edit, Trash2, Plus, Building2 } from 'lucide-react';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { CompanyForm } from './CompanyForm';
import { Company } from '../../types';
import { ConfirmDialog } from '../../utils/sweetalert';
import { companyService } from '../../services/company';
import { toast } from 'react-hot-toast';

interface CompanyTableProps {
  companies: Company[];
  onRefresh: () => void;
}

export function CompanyTable({ companies, onRefresh }: CompanyTableProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const result = await ConfirmDialog.fire({
      title: 'Excluir Empresa?',
      text: 'Todos os dados vinculados a esta empresa serão removidos. Esta ação é irreversível.',
      icon: 'warning',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      setDeletingId(id);
      await companyService.delete(id);
      toast.success('Empresa excluída com sucesso!');
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir empresa');
    } finally {
      setDeletingId(null);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingCompany(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    onRefresh();
  };

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 rounded-2xl shadow-lg overflow-hidden">
      <div className="p-6 border-b border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
            <Building2 size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white leading-tight">Empresas</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
              Gestão de unidades de negócio ({companies.length})
            </p>
          </div>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-xl">
          <Plus size={18} className="mr-2" />
          Nova Empresa
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50/50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Nome / Identificação
              </th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Documento (CNPJ)
              </th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Contato Principal
              </th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Status
              </th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {companies.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500 italic text-sm font-medium">
                  Nenhuma empresa cadastrada
                </td>
              </tr>
            ) : (
              companies.map((company) => (
                <tr key={company.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                    {company.nome}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {company.cnpj || 'Não informado'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {company.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full shadow-sm border ${
                        company.ativo
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800'
                          : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                      }`}
                    >
                      {company.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(company)}
                        className="rounded-lg hover:bg-white dark:hover:bg-gray-700 shadow-sm hover:shadow"
                        aria-label="Editar empresa"
                      >
                        <Edit size={14} className="text-emerald-600 dark:text-emerald-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(company.id)}
                        disabled={deletingId === company.id}
                        className="rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 shadow-sm hover:shadow"
                        aria-label="Excluir empresa"
                      >
                        {deletingId === company.id ? (
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
        title={editingCompany ? 'Editar Empresa' : 'Nova Empresa'}
        size="lg"
      >
        <CompanyForm
          company={editingCompany}
          onSuccess={handleFormSuccess}
          onCancel={handleFormClose}
        />
      </Modal>
    </div>
  );
}

