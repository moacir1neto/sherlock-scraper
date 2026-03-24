import { useState } from 'react';
import { motion } from 'framer-motion';
import { AIAnalysis } from '@/types';
import {
  Brain,
  TrendingDown,
  AlertTriangle,
  MessageCircle,
  Lightbulb,
  Target,
  CheckCircle2,
  Copy,
  Check,
  DollarSign,
  Shield,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AIAnalysisViewProps {
  analysis: AIAnalysis;
}

// Radial progress SVG component
function RadialScore({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;
  const offset = circumference - progress;

  const getColor = (s: number) => {
    if (s >= 8) return { stroke: '#22c55e', glow: 'rgba(34,197,94,0.3)', text: 'text-green-400', label: 'text-green-500' };
    if (s >= 5) return { stroke: '#eab308', glow: 'rgba(234,179,8,0.3)', text: 'text-yellow-400', label: 'text-yellow-500' };
    return { stroke: '#ef4444', glow: 'rgba(239,68,68,0.3)', text: 'text-red-400', label: 'text-red-500' };
  };

  const colors = getColor(score);

  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        {/* Background track */}
        <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        {/* Glow */}
        <circle
          cx="64" cy="64" r={radius} fill="none"
          stroke={colors.glow}
          strokeWidth="14"
          strokeDasharray={`${progress} ${offset}`}
          strokeLinecap="round"
          style={{ filter: 'blur(6px)' }}
        />
        {/* Progress arc */}
        <circle
          cx="64" cy="64" r={radius} fill="none"
          stroke={colors.stroke}
          strokeWidth="8"
          strokeDasharray={`${progress} ${offset}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${colors.text}`}>{score}</span>
        <span className="text-[10px] text-gray-500 uppercase tracking-widest">/ 10</span>
      </div>
    </div>
  );
}

// Copy button with "Copiado!" feedback
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all ${
        copied
          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
          : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'
      }`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  );
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function AIAnalysisView({ analysis }: AIAnalysisViewProps) {
  const getProbColor = (prob: string) => {
    const lower = prob.toLowerCase();
    if (lower === 'alta') return 'text-green-400 bg-green-500/10 border-green-500/20';
    if (lower === 'média') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    return 'text-red-400 bg-red-500/10 border-red-500/20';
  };

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-5 p-6 bg-gradient-to-br from-[#0c0c14] to-[#0f1020] rounded-2xl border border-white/[0.06]"
    >
      {/* Header - Score + Classification */}
      <motion.div variants={fadeUp} className="flex items-center gap-6">
        <RadialScore score={analysis.score_maturidade} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-purple-400 font-semibold uppercase tracking-wider">
              Análise de IA
            </span>
          </div>
          <h3 className="text-xl font-bold text-white mb-1">
            {analysis.classificacao}
          </h3>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${getProbColor(analysis.probabilidade_fechamento)}`}>
            <Target className="w-3 h-3" />
            Prob. Fechamento: {analysis.probabilidade_fechamento}
          </div>
        </div>
      </motion.div>

      {/* Impact Grid - Gap + Perda */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Gap Crítico */}
        <div className="bg-black/40 border border-red-500/15 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="p-1.5 bg-red-500/10 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
              Gap Crítico
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            {analysis.gap_critico}
          </p>
        </div>

        {/* Perda Estimada */}
        <div className="bg-black/40 border border-orange-500/15 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="p-1.5 bg-orange-500/10 rounded-lg">
              <TrendingDown className="w-4 h-4 text-orange-400" />
            </div>
            <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
              Perda Estimada
            </span>
          </div>
          <p className="text-lg font-bold text-white">
            {analysis.perda_estimada_mensal}
          </p>
          <p className="text-[11px] text-gray-500">por mês</p>
        </div>
      </motion.div>

      {/* Icebreaker WhatsApp */}
      <motion.div variants={fadeUp} className="bg-emerald-950/20 border border-emerald-500/15 rounded-xl p-4 relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Icebreaker WhatsApp
            </span>
          </div>
          <CopyButton text={analysis.icebreaker_whatsapp} label="Icebreaker" />
        </div>
        <div className="bg-black/30 rounded-lg p-3.5 border border-white/[0.04]">
          <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
            {analysis.icebreaker_whatsapp}
          </p>
        </div>
      </motion.div>

      {/* Pitch Comercial */}
      <motion.div variants={fadeUp} className="bg-blue-950/20 border border-blue-500/15 rounded-xl p-4 relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 rounded-lg">
              <Brain className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Pitch Comercial
            </span>
          </div>
          <CopyButton text={analysis.pitch_comercial} label="Pitch" />
        </div>
        <div className="bg-black/30 rounded-lg p-3.5 border border-white/[0.04]">
          <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
            {analysis.pitch_comercial}
          </p>
        </div>
      </motion.div>

      {/* Objeção e Resposta */}
      <motion.div variants={fadeUp} className="bg-black/40 border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-amber-500/10 rounded-lg">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Estratégia de Objeção
          </span>
        </div>

        <div className="space-y-3">
          {/* Objeção */}
          <div className="flex gap-3">
            <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-red-400">?</span>
            </div>
            <div>
              <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider mb-1">Objeção Prevista</p>
              <p className="text-sm text-gray-300 leading-relaxed">{analysis.objecao_prevista}</p>
            </div>
          </div>

          <div className="border-t border-white/[0.04]" />

          {/* Resposta */}
          <div className="flex gap-3">
            <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Lightbulb className="w-3 h-3 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mb-1">Resposta Sugerida</p>
              <p className="text-sm text-gray-300 leading-relaxed">{analysis.resposta_objecao}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Próximos Passos */}
      <motion.div variants={fadeUp} className="bg-black/40 border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-purple-500/10 rounded-lg">
            <Target className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
            Próximos Passos
          </span>
        </div>
        <ul className="space-y-2.5">
          {analysis.proximos_passos.map((passo, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-purple-400">{index + 1}</span>
              </div>
              <span className="text-sm text-gray-300 leading-relaxed">{passo}</span>
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}
