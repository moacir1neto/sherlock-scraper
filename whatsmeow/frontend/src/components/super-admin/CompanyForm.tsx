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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Nome da Organização"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          placeholder="Ex: WhatsMiau Corporate"
        />

        <Input
          label="CNPJ / Registro"
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          required
          placeholder="00.000.000/0000-00"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="E-mail Corporativo"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="contato@empresa.com"
        />

        <Input
          label="Telefone de Contato"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(00) 00000-0000"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
          Endereço Completo
        </label>
        <textarea
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200/60 dark:border-gray-700/60 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white font-medium placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
          rows={3}
          placeholder="Rua, Número, Bairro, Cidade - UF"
        />
      </div>

      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800">
        <div className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            id="ativo"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-500/20 dark:peer-focus:ring-emerald-800/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
          <label htmlFor="ativo" className="ml-3 text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer">
            {ativo ? 'Unidade Ativa' : 'Unidade Inativa'}
          </label>
        </div>
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
          {company ? 'Salvar Alterações' : 'Registrar Empresa'}
        </Button>
      </div>
    </form>
  );
}

