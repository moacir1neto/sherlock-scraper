import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, Calendar, Tag, Link2, User, Building2, Layers } from 'lucide-react';
import { AIPipelineStage, Lead, CreateLeadPayload } from '@/types';

interface LeadCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  stages: AIPipelineStage[];
  leads: Lead[];
  onSubmit: (data: CreateLeadPayload) => Promise<any>;
  pipelineName?: string;
}

export default function LeadCreateModal({
  isOpen,
  onClose,
  stages,
  leads,
  onSubmit,
  pipelineName,
}: LeadCreateModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [stageId, setStageId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [linkedLeadId, setLinkedLeadId] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const leadSearchRef = useRef<HTMLDivElement>(null);

  // Set default stage when modal opens
  useEffect(() => {
    if (isOpen && stages.length > 0 && !stageId) {
      setStageId(stages[0].id);
    }
  }, [isOpen, stages, stageId]);

  // Close lead dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (leadSearchRef.current && !leadSearchRef.current.contains(e.target as Node)) {
        setShowLeadDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const resetForm = () => {
    setCompanyName('');
    setEstimatedValue('');
    setDueDate('');
    setStageId(stages.length > 0 ? stages[0].id : '');
    setTags([]);
    setTagInput('');
    setLinkedLeadId('');
    setLeadSearch('');
    setSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const formatCurrency = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const num = parseInt(digits || '0', 10) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw === '' || raw === '0' || raw === '00') {
      setEstimatedValue('');
      return;
    }
    setEstimatedValue(formatCurrency(raw));
  };

  const parseCurrencyToNumber = (formatted: string): number => {
    if (!formatted) return 0;
    const cleaned = formatted.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/,/g, '');
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const filteredLeads = leads.filter(l =>
    l.Empresa.toLowerCase().includes(leadSearch.toLowerCase())
  ).slice(0, 8);

  const selectedLead = leads.find(l => l.ID === linkedLeadId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !stageId) return;

    setSubmitting(true);
    const payload: CreateLeadPayload = {
      company_name: companyName.trim(),
      stage_id: stageId,
      nicho: pipelineName || '',
      estimated_value: parseCurrencyToNumber(estimatedValue),
      due_date: dueDate || undefined,
      tags: tags.length > 0 ? tags.join(',') : undefined,
      linked_lead_id: linkedLeadId || undefined,
    };

    // If linked to a lead, inherit its contact & company data
    if (selectedLead) {
      if (selectedLead.Endereco) payload.endereco = selectedLead.Endereco;
      if (selectedLead.Telefone) payload.telefone = selectedLead.Telefone;
      if (selectedLead.TipoTelefone) payload.tipo_telefone = selectedLead.TipoTelefone;
      if (selectedLead.Email) payload.email = selectedLead.Email;
      if (selectedLead.Site) payload.site = selectedLead.Site;
      if (selectedLead.Instagram) payload.instagram = selectedLead.Instagram;
      if (selectedLead.Facebook) payload.facebook = selectedLead.Facebook;
      if (selectedLead.LinkedIn) payload.linkedin = selectedLead.LinkedIn;
      if (selectedLead.TikTok) payload.tiktok = selectedLead.TikTok;
      if (selectedLead.YouTube) payload.youtube = selectedLead.YouTube;
      if (selectedLead.ResumoNegocio) payload.resumo_negocio = selectedLead.ResumoNegocio;
      if (selectedLead.Rating) payload.rating = selectedLead.Rating;
      if (selectedLead.QtdAvaliacoes) payload.qtd_avaliacoes = selectedLead.QtdAvaliacoes;
      if (selectedLead.Nicho) payload.nicho = selectedLead.Nicho;
    }

    const result = await onSubmit(payload);
    if (result) {
      handleClose();
    } else {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedStage = stages.find(s => s.id === stageId);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          onClick={handleClose}
        />
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg bg-[#1A1A1A] border border-white/10 rounded-[28px] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-7 pt-7 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Novo Negócio</h2>
              <p className="text-sm text-gray-500 mt-0.5">Preencha os dados do negócio</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-7 pb-7 space-y-4">
            {/* Company Name */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <Building2 size={14} />
                Título do negócio
              </label>
              <input
                autoFocus
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Ex: Empresa XYZ - Projeto Website"
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>

            {/* Value + Due Date Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  <DollarSign size={14} />
                  Valor previsto
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">R$</span>
                  <input
                    type="text"
                    value={estimatedValue}
                    onChange={handleValueChange}
                    placeholder="0,00"
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-11 pr-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  <Calendar size={14} />
                  Data prevista
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Stage Select */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <Layers size={14} />
                Estágio do pipeline
              </label>
              <div className="relative">
                {selectedStage && (
                  <span
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: selectedStage.color }}
                  />
                )}
                <select
                  value={stageId}
                  onChange={e => setStageId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all appearance-none cursor-pointer"
                >
                  {stages.map(stage => (
                    <option key={stage.id} value={stage.id} className="bg-[#1a1a1a] text-white">
                      {stage.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Responsible (static for now - current user) */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <User size={14} />
                Responsável
              </label>
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                  EU
                </div>
                <span className="text-sm text-gray-300">Usuário atual</span>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <Tag size={14} />
                Tags
              </label>
              <div className="flex flex-wrap gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 min-h-[44px] focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/30 transition-all">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 bg-blue-500/20 text-blue-400 text-xs font-bold px-2.5 py-1 rounded-lg"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-white transition-colors ml-0.5"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder={tags.length === 0 ? 'Digite e pressione Enter...' : ''}
                  className="flex-1 min-w-[120px] bg-transparent text-white text-sm placeholder:text-gray-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Link to Lead */}
            <div ref={leadSearchRef} className="relative">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <Link2 size={14} />
                Vincular a um lead
              </label>
              {selectedLead ? (
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400 text-xs font-bold">
                      {selectedLead.Empresa.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-300">{selectedLead.Empresa}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setLinkedLeadId(''); setLeadSearch(''); }}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={leadSearch}
                  onChange={e => { setLeadSearch(e.target.value); setShowLeadDropdown(true); }}
                  onFocus={() => setShowLeadDropdown(true)}
                  placeholder="Buscar lead pelo nome..."
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
                />
              )}
              {showLeadDropdown && !selectedLead && leadSearch && (
                <div className="absolute z-10 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                  {filteredLeads.length > 0 ? (
                    filteredLeads.map(lead => (
                      <button
                        key={lead.ID}
                        type="button"
                        onClick={() => {
                          setLinkedLeadId(lead.ID);
                          setLeadSearch(lead.Empresa);
                          setShowLeadDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 text-[10px] font-bold shrink-0">
                          {lead.Empresa.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm text-gray-200 truncate">{lead.Empresa}</p>
                          <p className="text-[10px] text-gray-600">{lead.Nicho}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-600 text-center">Nenhum lead encontrado</div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl font-medium text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!companyName.trim() || !stageId || submitting}
                className="flex-[2] px-4 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-green-900/20 text-sm transition-all active:scale-[0.98]"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Criando...
                  </span>
                ) : (
                  'Criar Negócio'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
