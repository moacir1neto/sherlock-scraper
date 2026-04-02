import { useState, useEffect } from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { Company } from '../../types';
import { companyService } from '../../services/company';
import { toast } from 'react-hot-toast';

interface CompanyFormProps {
  company?: Company | null;
  onSuccess: () => void;
  onCancel: () => void;
  onSubmit?: (data: any) => Promise<void>;
}

export function CompanyForm({ company, onSuccess, onCancel, onSubmit }: CompanyFormProps) {
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (company) {
      setNome(company.nome);
      setCnpj(company.cnpj);
      setEmail(company.email);
      setTelefone(company.telefone || '');
      setEndereco(company.endereco || '');
      setAtivo(company.ativo);
    }
  }, [company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        nome,
        cnpj,
        email,
        telefone: telefone || undefined,
        endereco: endereco || undefined,
        ativo,
      };

      if (onSubmit) {
        await onSubmit(data);
      } else {
        if (company) {
          await companyService.update(company.id, data);
          toast.success('Empresa atualizada com sucesso!');
        } else {
          await companyService.create(data);
          toast.success('Empresa criada com sucesso!');
        }
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar empresa');
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
        placeholder="Nome da empresa"
      />

      <Input
        label="CNPJ"
        value={cnpj}
        onChange={(e) => setCnpj(e.target.value)}
        required
        placeholder="00.000.000/0000-00"
      />

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="contato@empresa.com"
      />

      <Input
        label="Telefone"
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
        placeholder="(00) 00000-0000"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Endereço
        </label>
        <textarea
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          rows={3}
          placeholder="Endereço completo"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="ativo"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <label htmlFor="ativo" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
          Empresa ativa
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : company ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
}

