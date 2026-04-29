import { useState } from 'react';
import { Lead } from '@/types';
import { 
  Brain, 
  Sparkles, 
  BookOpen, 
  ShieldAlert,
  Zap,
  Lightbulb,
  Loader2,
  Cpu,
  Thermometer,
  Flame,
  Snowflake,
  TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

interface TabInteligenciaProps {
  lead: Lead;
  onAnalyze: (leadId: string) => Promise<any>;
}

export default function TabInteligencia({ lead, onAnalyze }: TabInteligenciaProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const aiAnalysis = lead.ai_analysis;
  const hasAIData = !!(lead.ai_analysis);

  const handleGenerateDossie = async () => {
    setIsGenerating(true);
    
    toast('Iniciando análise neural...', {
      icon: '🧠',
      style: {
        borderRadius: '12px',
        background: '#1e1b4b',
        color: '#fff',
      },
      duration: 3000,
    });

    try {
      await onAnalyze(lead.ID);
      toast.success('Dossiê gerado com sucesso!', {
        icon: '✨',
        style: {
          borderRadius: '12px',
          background: '#047857',
          color: '#fff',
        },
      });
    } catch (error) {
      // Erro já é tratado no hook/onAnalyze com toast
    } finally {
      setIsGenerating(false);
    }
  };

  // Se estiver gerando, mostra o loading premium
  if (isGenerating) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-indigo-50/30 to-purple-50/50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative mb-8"
        >
          <div className="absolute inset-0 bg-indigo-200 rounded-full blur-2xl opacity-20 animate-pulse" />
          <div className="relative w-24 h-24 bg-white rounded-3xl shadow-xl border border-indigo-100 flex items-center justify-center overflow-hidden">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute"
            >
              <Loader2 size={60} className="text-indigo-200" strokeWidth={1} />
            </motion.div>
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                color: ['#4f46e5', '#9333ea', '#4f46e5']
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Cpu size={40} className="relative z-10" />
            </motion.div>
          </div>
        </motion.div>
        
        <div className="space-y-3 max-w-xs">
          <h3 className="text-lg font-bold text-gray-900 animate-pulse">Sherlock Neural está pensando...</h3>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-indigo-600 font-medium px-4 py-1.5 bg-indigo-50 rounded-full border border-indigo-100/50 self-center">
              Analisando presença digital...
            </p>
            <p className="text-xs text-gray-400 italic">
              "Processando vetores de objeção realistas..."
            </p>
          </div>
        </div>

        {/* Barra de progresso real (simulada via animação durante o await) */}
        <div className="w-48 h-1.5 bg-gray-100 rounded-full mt-8 overflow-hidden">
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: "95%" }}
            transition={{ duration: 5 }}
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
          />
        </div>
      </div>
    );
  }

  // Se não tem dados e não está gerando, mostra o Empty State
  if (!hasAIData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-transparent to-purple-50/30">
        <div className="w-20 h-20 bg-purple-100 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-purple-200/50">
          <Brain size={40} className="text-purple-600 animate-pulse" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Dossiê não encontrado</h3>
        <p className="text-gray-500 max-w-sm mb-8">
          A nossa Inteligência Artificial ainda não processou os dados deste lead para criar um dossiê estratégico.
        </p>
        <button
          onClick={handleGenerateDossie}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-indigo-200 group"
        >
          <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
          Gerar Dossiê de Inteligência
        </button>
      </div>
    );
  }

  const score = (aiAnalysis?.score_maturidade || 0) * 10;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-6 bg-gradient-to-br from-indigo-50/20 via-transparent to-purple-50/30 min-h-full"
    >
      {/* Lead Score Thermometer */}
      {aiAnalysis && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm overflow-hidden relative group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Brain size={80} className="text-indigo-600" />
          </div>
          
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                score >= 80 
                  ? 'bg-emerald-50 text-emerald-600' 
                  : score >= 50 
                  ? 'bg-amber-50 text-amber-600' 
                  : 'bg-rose-50 text-rose-600'
              }`}>
                {score >= 80 ? <Flame size={20} /> : score < 50 ? <Snowflake size={20} /> : <Thermometer size={20} />}
              </div>
              <div>
                <h4 className="font-bold text-gray-900 leading-tight">Lead Score Neural</h4>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Potencial de Conversão</p>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-black ${score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                {score}<span className="text-sm font-bold text-gray-300">/100</span>
              </span>
            </div>
          </div>

          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className={`h-full relative ${
                score >= 80 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                  : score >= 50 
                  ? 'bg-gradient-to-r from-amber-500 to-orange-400' 
                  : 'bg-gradient-to-r from-rose-500 to-pink-400'
              }`}
            >
              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[pulse_2s_infinite]" />
            </motion.div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-500">
                {score >= 80 ? 'Alta Prioridade' : score >= 50 ? 'Média Prioridade' : 'Baixa Prioridade'}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-medium">Análise baseada em maturidade digital</span>
          </div>
        </div>
      )}

      {/* Resumo do Negócio */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <BookOpen size={20} className="text-blue-600" />
          </div>
          <div>
            <h4 className="font-bold text-gray-900">Resumo do Negócio</h4>
            <p className="text-xs text-gray-400">Visão geral estratégica da empresa</p>
          </div>
        </div>
        <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-50">
          <p className="text-sm text-gray-600 leading-relaxed italic">
            "{aiAnalysis?.gap_critico || lead.ResumoNegocio || 'Nenhuma análise detalhada disponível.'}"
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quebra-gelos */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Zap size={20} className="text-amber-600" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900">Quebra-gelos</h4>
              <p className="text-xs text-gray-400">Como iniciar o contato</p>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="p-3 bg-amber-50/30 rounded-xl border border-amber-100/50">
              <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-line">
                {aiAnalysis?.icebreaker_whatsapp || '—'}
              </p>
            </div>
            <div className="p-3 bg-indigo-50/30 rounded-xl border border-indigo-100/50 group cursor-pointer hover:bg-indigo-50 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb size={14} className="text-indigo-600" />
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Insight IA</span>
              </div>
              <p className="text-xs text-indigo-900">
                Use um tom {aiAnalysis?.classificacao || 'profissional'} e consultivo.
              </p>
            </div>
          </div>
        </div>

        {/* Dores & Objeções */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
              <ShieldAlert size={20} className="text-rose-600" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900">Dores & Objeções</h4>
              <p className="text-xs text-gray-400">Pontos críticos e desafios</p>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-2 block">Provável Objeção</span>
              <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                <p className="text-sm text-rose-900 font-medium">
                  {aiAnalysis?.objecao_prevista || '—'}
                </p>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2 block">Como Contornar</span>
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                <p className="text-sm text-emerald-900">
                  {aiAnalysis?.resposta_objecao || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="h-px bg-gray-100 flex-1" />
        <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full">
          <Brain size={12} className="text-gray-400" />
          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Sherlock Neural Insights</span>
        </div>
        <div className="h-px bg-gray-100 flex-1" />
      </div>
    </motion.div>
  );
}
