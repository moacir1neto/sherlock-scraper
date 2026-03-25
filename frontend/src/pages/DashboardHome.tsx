import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Briefcase,
  MessageCircle,
  Bot,
  Users,
  Rocket,
  TrendingUp,
  DollarSign,
  Percent,
  Target
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePipeline } from '@/hooks/usePipeline';
import { useLeads } from '@/hooks/useLeads';
import { AIPipelineResponse } from '@/types';

const ONBOARDING_STEPS = [
  { 
    id: 'pipeline', 
    title: 'Pipeline', 
    desc: 'Crie seu funil de vendas', 
    icon: Briefcase, 
    path: '/dashboard/pipeline',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10'
  },
  { 
    id: 'canal', 
    title: 'Canal', 
    desc: 'Conecte seu WhatsApp', 
    icon: MessageCircle, 
    path: '/dashboard/configuracoes',
    color: 'text-green-400',
    bg: 'bg-green-500/10'
  },
  { 
    id: 'agente', 
    title: 'Agente IA', 
    desc: 'Configure seu SDR Automático', 
    icon: Bot, 
    path: '/dashboard/configuracoes',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10'
  },
  { 
    id: 'leads', 
    title: 'Leads', 
    desc: 'Buscador B2B', 
    icon: Users, 
    path: '/dashboard/raspagens',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10'
  },
  { 
    id: 'campanha', 
    title: 'Campanha', 
    desc: 'Inicie sua prospecção', 
    icon: Rocket, 
    path: '/dashboard/listas',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10'
  },
];


export default function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { fetchPipeline } = usePipeline();
  const { leads, fetchLeads } = useLeads();
  const [hasPipeline, setHasPipeline] = useState(false);
  const [pipelineData, setPipelineData] = useState<AIPipelineResponse | null>(null);

  useEffect(() => {
    const handleCheckPipeline = async () => {
      try {
        const data = await fetchPipeline();
        if (data) {
          setHasPipeline(true);
          setPipelineData(data);
          localStorage.setItem('pipeline_generated', 'true');
          await fetchLeads();
        } else {
          const local = localStorage.getItem('pipeline_generated') === 'true';
          setHasPipeline(local);
        }
      } catch (error: any) {
        if (error?.response?.status === 401) {
          navigate('/login');
          return;
        }
        const local = localStorage.getItem('pipeline_generated') === 'true';
        setHasPipeline(local);
      }
    };
    handleCheckPipeline();
  }, [fetchPipeline, fetchLeads, navigate]);

  // KPI calculations
  const metrics = useMemo(() => {
    const stages = pipelineData?.stages || [];
    const finalStageId = stages.length > 0 ? stages[stages.length - 1].id : null;
    const wonLeads = finalStageId ? leads.filter((l) => l.KanbanStatus === finalStageId) : [];
    const faturamento = wonLeads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
    const pipelineTotal = leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
    const negociosAtivos = leads.length - wonLeads.length;
    const taxaConversao = leads.length > 0 ? Math.round((wonLeads.length / leads.length) * 100) : 0;

    const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    return [
      { title: 'Pipeline Total', value: formatBRL(pipelineTotal), subtext: 'Valor estimado', icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { title: 'Negócios Ativos', value: String(negociosAtivos), subtext: 'Em aberto agora', icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { title: 'Conversão', value: `${taxaConversao}%`, subtext: 'Neste período', icon: Percent, color: 'text-purple-400', bg: 'bg-purple-500/10' },
      { title: 'Faturamento', value: formatBRL(faturamento), subtext: 'Negócios ganhos', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    ];
  }, [leads, pipelineData]);

  // Simple progress calculation based on mocked data
  const completedSteps = hasPipeline ? 1 : 0;
  const progressPercent = Math.round((completedSteps / ONBOARDING_STEPS.length) * 100);

  return (
    <div className="h-full flex flex-col space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Bom dia, {user?.email?.split('@')[0] || 'Usuário'}
          </h1>
          <p className="text-gray-400 mt-1">
            Aqui está o resumo do seu Cockpit de Vendas.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select className="bg-black/40 border border-white/10 text-gray-300 text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500">
            <option>Últimos 7 dias</option>
            <option>Últimos 30 dias</option>
            <option>Este mês</option>
            <option>Todo o período</option>
          </select>
        </div>
      </div>

      {/* Onboarding Section */}
      <div className="bg-[#121214] border border-white/10 rounded-2xl p-6 relative overflow-hidden">
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Primeiros Passos</h2>
              <p className="text-sm text-gray-400">Complete a configuração do seu CRM Automático.</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-blue-400">{progressPercent}% concluído</span>
              <div className="w-32 h-2.5 bg-gray-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${progressPercent}%` }} 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {ONBOARDING_STEPS.map((step, idx) => {
              const isCompleted = step.id === 'pipeline' && hasPipeline;
              
              return (
                <button
                  key={step.id}
                  onClick={() => navigate(step.path)}
                  className="group relative flex flex-col items-center bg-black/40 border border-white/5 hover:border-white/20 rounded-xl p-5 transition-all text-center"
                >
                  <div className="absolute top-3 right-3">
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-dashed border-gray-600 group-hover:border-gray-400 transition-colors" />
                    )}
                  </div>
                  
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${step.bg} ${step.color}`}>
                    <step.icon className="w-6 h-6" />
                  </div>
                  
                  <h3 className="font-medium text-white text-sm mb-1">{step.title}</h3>
                  <p className="text-xs text-gray-500">{step.desc}</p>

                  {!isCompleted && idx === completedSteps && (
                    <div className="absolute -bottom-1.5 w-1/2 h-1 bg-blue-500 blur-sm rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, i) => (
          <div key={i} className="bg-black/40 border border-white/5 rounded-2xl p-6 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${metric.bg} ${metric.color}`}>
                <metric.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-gray-500 bg-white/5 px-2 py-1 rounded-md">Ao vivo</span>
            </div>
            <h3 className="text-gray-400 text-sm font-medium">{metric.title}</h3>
            <p className="text-3xl font-bold text-white mt-1">{metric.value}</p>
            <p className="text-xs text-emerald-400 font-medium mt-2">{metric.subtext}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
