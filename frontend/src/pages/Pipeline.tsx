import React, { useState, useEffect } from 'react';
import PipelineOnboardingModal from '@/components/pipeline/PipelineOnboardingModal';
import { AIPipelineResponse } from '@/types';
import { usePipeline } from '@/hooks/usePipeline';

export default function Pipeline() {
  const { fetchPipeline } = usePipeline();
  const [pipelineState, setPipelineState] = useState<AIPipelineResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

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

  const handlePipelineGenerated = (data: AIPipelineResponse) => {
    setPipelineState(data);
    localStorage.setItem('pipeline_generated', 'true');
  };

  if (isFetching) {
    return (
      <div className="h-full flex flex-col pt-2 items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pt-2">
      <div className="mb-6 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">CRM Pipeline</h1>
        <p className="text-gray-400 mt-1">Gerencie seu funil de vendas inteligente.</p>
      </div>

      <PipelineOnboardingModal
        isOpen={isModalOpen && !pipelineState}
        onClose={() => setIsModalOpen(false)}
        onPipelineGenerated={handlePipelineGenerated}
      />

      {pipelineState ? (
        <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex h-full items-start space-x-6 min-w-max pb-4">
            {pipelineState.stages.map((column, index) => (
              <div key={index} className="w-[320px] flex flex-col h-full max-h-full">
                <div className="flex items-center justify-between mb-4 px-1 shrink-0">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: column.color }}
                    />
                    <h3 className="font-semibold text-gray-300 tracking-wider text-sm uppercase">
                      {column.name}
                    </h3>
                  </div>
                  <span className="bg-white/10 text-xs font-semibold px-2.5 py-1 rounded-full">
                    0 R$ 0,00
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl p-3 border border-transparent transition-colors bg-black/30">
                  <div className="h-full w-full flex items-center justify-center text-gray-500 text-sm italic">
                    Nenhum lead nesta etapa
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/10 rounded-2xl">
          <div className="text-center">
            <h3 className="text-xl font-medium text-gray-300 mb-2">Seu Pipeline está vazio</h3>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition-colors"
            >
              Criar com IA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
