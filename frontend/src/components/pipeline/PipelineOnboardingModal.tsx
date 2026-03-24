import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, FileText, Plus, ArrowRight } from 'lucide-react';
import { usePipeline } from '@/hooks/usePipeline';
import { AIPipelineResponse } from '@/types';

interface PipelineOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPipelineGenerated: (pipeline: AIPipelineResponse) => void;
}

export default function PipelineOnboardingModal({
  isOpen,
  onClose,
  onPipelineGenerated,
}: PipelineOnboardingModalProps) {
  const [step, setStep] = useState<'choice' | 'input' | 'loading'>('choice');
  const [niche, setNiche] = useState('');
  const { generatePipelineWithAI } = usePipeline();

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!niche.trim()) return;
    setStep('loading');
    try {
      const data = await generatePipelineWithAI(niche);
      onPipelineGenerated(data);
      onClose();
    } catch (error) {
      setStep('input');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-xl bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl p-6 md:p-8"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {step === 'choice' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                  Como você quer criar seu Kanban?
                </h2>
                <p className="text-gray-400 mt-2">Escolha a melhor forma de iniciar seu funil de vendas</p>
              </div>

              <div className="grid gap-4">
                <button
                  onClick={() => setStep('input')}
                  className="group relative flex items-center p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl hover:border-blue-500/60 transition-all duration-300"
                >
                  <div className="w-12 h-12 flex items-center justify-center bg-blue-500/20 text-blue-400 rounded-lg group-hover:scale-110 transition-transform">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div className="ml-4 text-left">
                    <h3 className="text-lg font-semibold text-white">Criar com Inteligência Artificial</h3>
                    <p className="text-sm text-gray-400">Deixe a IA montar o funil ideal para o seu nicho</p>
                  </div>
                  <ArrowRight className="absolute right-4 text-blue-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>

                <button className="group flex items-center p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors opacity-50 cursor-not-allowed">
                  <div className="w-12 h-12 flex items-center justify-center bg-white/5 text-gray-400 rounded-lg">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="ml-4 text-left">
                    <h3 className="text-lg font-semibold text-gray-300">Usar um Playbook (Em breve)</h3>
                    <p className="text-sm text-gray-500">Escolha entre templates pré-definidos de vendas</p>
                  </div>
                </button>

                <button className="group flex items-center p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors opacity-50 cursor-not-allowed">
                  <div className="w-12 h-12 flex items-center justify-center bg-white/5 text-gray-400 rounded-lg">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div className="ml-4 text-left">
                    <h3 className="text-lg font-semibold text-gray-300">Começar do Zero (Em breve)</h3>
                    <p className="text-sm text-gray-500">Crie cada etapa manualmente</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 'input' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Qual é o seu negócio?</h2>
                <p className="text-gray-400 mt-2">Descreva em uma frase curta para a IA gerar o melhor funil.</p>
              </div>

              <div>
                <input
                  autoFocus
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="Ex: Agência de Marketing Digital, Software House..."
                  className="w-full bg-black/50 border border-white/10 text-white rounded-xl px-4 py-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-center text-lg"
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('choice')}
                  className="px-6 py-3 rounded-xl font-medium text-gray-300 hover:bg-white/5 transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!niche.trim()}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl py-3 font-medium shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center justify-center"
                >
                  <Bot className="w-5 h-5 mr-2" />
                  Gerar Funil Completo
                </button>
              </div>
            </motion.div>
          )}

          {step === 'loading' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-12 flex flex-col items-center justify-center space-y-6 text-center"
            >
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-500/20 rounded-full"></div>
                <div className="absolute top-0 left-0 w-20 h-20 border-4 border-t-blue-500 border-r-purple-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                <Bot className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-blue-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                  A IA está construindo seu funil...
                </h3>
                <p className="text-gray-400 mt-2 max-w-xs mx-auto text-sm">
                  Analisando o nicho de "{niche}" para extrair as melhores etapas de conversão comercial.
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
