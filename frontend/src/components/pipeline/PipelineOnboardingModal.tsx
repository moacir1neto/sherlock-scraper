import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, FileText, Plus, ArrowRight, ChevronLeft } from 'lucide-react';
import { usePipeline } from '@/hooks/usePipeline';
import { AIPipelineResponse } from '@/types';
import toast from 'react-hot-toast';

interface PipelineOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPipelineGenerated: (pipeline: AIPipelineResponse) => void;
}

const PLAYBOOKS = [
  {
    id: 'saas_b2b',
    title: 'SaaS B2B',
    desc: 'Funil otimizado para softwares e serviços recorrentes.',
    steps: ['Prospecção', 'Demo Agendada', 'Trial', 'Fechamento'],
    icon: Bot,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10'
  },
  {
    id: 'marketing_agency',
    title: 'Agência de Marketing',
    desc: 'Foco em captação, briefing e fechamento de contratos.',
    steps: ['Lead Frio', 'Qualificação', 'Reunião de Briefing', 'Proposta Enviada', 'Ganho'],
    icon: FileText,
    color: 'text-green-400',
    bg: 'bg-green-500/10'
  },
  {
    id: 'high_ticket',
    title: 'Infoproduto / High Ticket',
    desc: 'Estratégia baseada em aplicação e fechamento 1-a-1.',
    steps: ['Lead', 'Aplicação Recebida', 'Call de Vendas', 'Negociação', 'Fechado'],
    icon: Plus,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10'
  }
];

export default function PipelineOnboardingModal({
  isOpen,
  onClose,
  onPipelineGenerated,
}: PipelineOnboardingModalProps) {
  const [step, setStep] = useState<'choice' | 'input' | 'loading' | 'playbook_selection'>('choice');
  const [niche, setNiche] = useState('');
  const { generatePipelineWithAI, createPipeline } = usePipeline();

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

  const handleSelectPlaybook = async (playbook: typeof PLAYBOOKS[0]) => {
    setStep('loading');
    
    // Map playbook stages to the required format
    const playbooksData: Record<string, string[]> = {
      'saas_b2b': ["Prospecção", "Qualificação", "Demo Agendada", "Trial", "Fechamento"],
      'marketing_agency': ["Lead Frio", "Reunião de Briefing", "Proposta Enviada", "Negociação", "Ganho"],
      'high_ticket': ["Lead", "Aplicação", "Call de Vendas", "Aguardando Pagamento", "Aluno"]
    };

    const stages = playbooksData[playbook.id].map((name, index) => ({
      name,
      order: index + 1,
      color: '#3b82f6' // Default blue for all
    }));

    try {
      const data = await createPipeline({
        name: playbook.title,
        stages
      });

      if (data) {
        onPipelineGenerated(data);
        onClose();
      } else {
        setStep('playbook_selection');
      }
    } catch (error) {
      setStep('playbook_selection');
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
          className="relative w-full max-w-xl bg-[#1A1A1A] border border-white/10 rounded-[32px] shadow-2xl p-6 md:p-10 overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Bot size={200} />
          </div>

          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {step === 'choice' && (
            <div className="space-y-8 relative z-10">
              <div className="text-center">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-500 bg-clip-text text-transparent mb-3">
                  Como você quer criar seu Kanban?
                </h2>
                <p className="text-gray-400 text-lg">Escolha a melhor forma de iniciar seu funil de vendas</p>
              </div>

              <div className="grid gap-5">
                <button
                  onClick={() => setStep('input')}
                  className="group relative flex items-center p-6 bg-white/[0.03] border border-white/5 rounded-[24px] hover:bg-white/[0.06] hover:border-blue-500/50 transition-all duration-300"
                >
                  <div className="w-14 h-14 flex items-center justify-center bg-blue-500/20 text-blue-400 rounded-2xl group-hover:scale-110 transition-transform">
                    <Bot className="w-7 h-7" />
                  </div>
                  <div className="ml-5 text-left">
                    <h3 className="text-xl font-bold text-white">Criar com Inteligência Artificial</h3>
                    <p className="text-sm text-gray-400">Deixe a IA montar o funil ideal para o seu nicho</p>
                  </div>
                  <ArrowRight className="absolute right-6 text-blue-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>

                <button 
                  onClick={() => setStep('playbook_selection')}
                  className="group relative flex items-center p-6 bg-white/[0.03] border border-white/5 rounded-[24px] hover:bg-white/[0.06] hover:border-purple-500/50 transition-all duration-300"
                >
                  <div className="w-14 h-14 flex items-center justify-center bg-purple-500/20 text-purple-400 rounded-2xl group-hover:scale-110 transition-transform">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div className="ml-5 text-left">
                    <h3 className="text-xl font-bold text-white">Usar um Playbook</h3>
                    <p className="text-sm text-gray-400">Escolha entre templates pré-definidos de vendas</p>
                  </div>
                  <ArrowRight className="absolute right-6 text-purple-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>

                <button className="group flex items-center p-6 bg-white/5 border border-white/5 rounded-[24px] hover:bg-white/10 transition-colors opacity-40 cursor-not-allowed">
                  <div className="w-14 h-14 flex items-center justify-center bg-white/5 text-gray-500 rounded-2xl">
                    <Plus className="w-7 h-7" />
                  </div>
                  <div className="ml-5 text-left">
                    <h3 className="text-xl font-bold text-gray-400">Começar do Zero (Em breve)</h3>
                    <p className="text-sm text-gray-600">Crie cada etapa manualmente</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 'playbook_selection' && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8 relative z-10"
            >
              <div className="flex items-center mb-2">
                <button 
                  onClick={() => setStep('choice')}
                  className="p-2 -ml-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-all"
                >
                  <ChevronLeft size={24} />
                </button>
              </div>

              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Escolha um Playbook</h2>
                <p className="text-gray-400">Modelos validados de mercado para sua operação comercial.</p>
              </div>

              <div className="grid gap-4 max-h-[400px] overflow-y-auto px-1 custom-scrollbar">
                {PLAYBOOKS.map((playbook) => (
                  <button
                    key={playbook.id}
                    onClick={() => handleSelectPlaybook(playbook)}
                    className="group flex flex-col p-6 bg-white/[0.03] border border-white/5 rounded-[24px] hover:bg-white/[0.06] hover:border-white/20 transition-all text-left"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-12 h-12 flex items-center justify-center ${playbook.bg} ${playbook.color} rounded-xl`}>
                        <playbook.icon size={24} />
                      </div>
                      <div className="flex -space-x-1">
                        {playbook.steps.slice(0, 3).map((_, i) => (
                          <div key={i} className={`w-2 h-2 rounded-full border border-[#1A1A1A] ${playbook.bg.replace('/10', '/50')}`} />
                        ))}
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">{playbook.title}</h3>
                    <p className="text-sm text-gray-400 mb-4 leading-relaxed">{playbook.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {playbook.steps.map((s, i) => (
                        <span key={i} className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-white/5 text-gray-500 rounded-md">
                          {s}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
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
