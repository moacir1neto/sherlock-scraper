import React, { useState, useEffect, useRef } from 'react';
import PipelineOnboardingModal from '@/components/pipeline/PipelineOnboardingModal';
import { AIPipelineResponse } from '@/types';
import { usePipeline } from '@/hooks/usePipeline';
import { ChevronDown, Plus, Edit2, Trash2, Layout, MoreVertical } from 'lucide-react';
import Swal from 'sweetalert2';

export default function Pipeline() {
  const { fetchPipeline, deletePipeline } = usePipeline();
  const [pipelineState, setPipelineState] = useState<AIPipelineResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkExisting = async () => {
      const data = await fetchPipeline();
      if (data) {
        setPipelineState(data);
      } else {
        setIsModalOpen(true);
      }
      setIsFetching(false);
    };
    checkExisting();
  }, [fetchPipeline]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePipelineGenerated = (data: AIPipelineResponse) => {
    setPipelineState(data);
    localStorage.setItem('pipeline_generated', 'true');
  };

  const handleDeletePipeline = async () => {
    const result = await Swal.fire({
      title: 'Excluir Pipeline?',
      text: "Tem certeza? Esta ação não pode ser desfeita.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#374151',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar',
      background: '#1a1a1a',
      color: '#fff',
      customClass: {
        popup: 'rounded-2xl border border-white/10 shadow-2xl overflow-hidden'
      }
    });

    if (result.isConfirmed) {
      const success = await deletePipeline();
      if (success) {
        setPipelineState(null);
        setIsModalOpen(true);
        setIsDropdownOpen(false);
      }
    }
  };

  if (isFetching) {
    return (
      <div className="h-full flex flex-col pt-2 items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pt-2 bg-black/20">
      {/* HEADER */}
      <div className="mb-8 shrink-0 flex items-center justify-between px-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            CRM Pipeline
          </h1>
          <p className="text-gray-400 mt-1">Gerencie seu funil de vendas inteligente.</p>
        </div>

        {pipelineState && (
          <div className="flex items-center space-x-4">
            {/* Pipeline Selector / Management Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-3 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-200 group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <Layout size={18} />
                </div>
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold leading-none mb-1">Pipeline Atual</p>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-200">{pipelineState.pipeline_name || pipelineState.name}</span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
                  <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5 mb-1">
                    Gerenciamento
                  </div>
                  <button className="w-full flex items-center space-x-3 px-4 py-2.5 hover:bg-white/5 text-gray-300 text-sm transition-colors">
                    <Plus size={16} className="text-blue-400" />
                    <span>Novo Pipeline</span>
                  </button>
                  <button className="w-full flex items-center space-x-3 px-4 py-2.5 hover:bg-white/5 text-gray-300 text-sm transition-colors">
                    <Edit2 size={16} className="text-orange-400" />
                    <span>Editar Pipeline</span>
                  </button>
                  <button className="w-full flex items-center space-x-3 px-4 py-2.5 hover:bg-white/5 text-gray-300 text-sm transition-colors">
                    <Plus size={16} className="text-green-400" />
                    <span>Adicionar Coluna</span>
                  </button>
                  <div className="h-px bg-white/5 my-1 mx-2"></div>
                  <button 
                    onClick={handleDeletePipeline}
                    className="w-full flex items-center space-x-3 px-4 py-2.5 hover:bg-red-500/10 text-red-500 text-sm transition-colors"
                  >
                    <Trash2 size={16} />
                    <span>Excluir Pipeline</span>
                  </button>
                </div>
              )}
            </div>

            {/* Action Button */}
            <button className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-900/20 active:scale-95 transition-all">
              <Plus size={18} strokeWidth={3} />
              <span>Novo negócio</span>
            </button>
          </div>
        )}
      </div>

      <PipelineOnboardingModal
        isOpen={isModalOpen && !pipelineState}
        onClose={() => setIsModalOpen(false)}
        onPipelineGenerated={handlePipelineGenerated}
      />

      {pipelineState ? (
        <div className="flex-1 overflow-x-auto pb-6 px-4 custom-scrollbar">
          <div className="flex h-full items-start space-x-6 min-w-max">
            {pipelineState.stages.map((column, index) => (
              <div key={index} className="w-[320px] flex flex-col h-full max-h-full">
                <div className="flex items-center justify-between mb-4 px-2 shrink-0">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-2.5 h-2.5 rounded-full ring-4 ring-opacity-20 shadow-[0_0_12px_rgba(0,0,0,0.5)]" 
                      style={{ backgroundColor: column.color, boxShadow: `0 0 10px ${column.color}44` }}
                    />
                    <h3 className="font-bold text-gray-200 tracking-wide text-sm uppercase">
                      {column.name}
                    </h3>
                  </div>
                  <span className="bg-white/5 text-[10px] font-bold text-gray-400 px-2 py-0.5 rounded-md border border-white/5">
                    0 R$ 0,00
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar rounded-3xl p-3 border border-white/5 bg-[#141414]/50 backdrop-blur-sm group-hover:border-white/10 transition-colors">
                  <div className="h-full w-full flex flex-col items-center justify-center text-gray-600 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                      <Layout size={20} className="opacity-20" />
                    </div>
                    <p className="text-xs italic">Nenhum lead nesta etapa</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-12 text-center border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.02] backdrop-blur-sm">
            <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-500 mx-auto mb-6">
              <Layout size={40} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Seu Pipeline está vazio</h3>
            <p className="text-gray-400 mb-8 leading-relaxed">
              Deixe nossa IA criar um funil de vendas sob medida para o seu nicho de negócio em segundos.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-900/20 active:scale-95 transition-all"
            >
              <Plus size={20} />
              <span>Criar Pipeline com IA</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
