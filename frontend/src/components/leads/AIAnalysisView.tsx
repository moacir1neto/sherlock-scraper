import { AIAnalysis } from '@/types';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  MessageCircle,
  Lightbulb,
  Target,
  CheckCircle2,
  Copy,
  DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AIAnalysisViewProps {
  analysis: AIAnalysis;
}

export function AIAnalysisView({ analysis }: AIAnalysisViewProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência!`);
  };

  // Determina a cor do badge de score
  const getScoreBadgeColor = (score: number) => {
    if (score >= 8) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 4) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  // Determina a cor da probabilidade de fechamento
  const getProbabilityColor = (prob: string) => {
    const lower = prob.toLowerCase();
    if (lower === 'alta') return 'text-green-600 font-semibold';
    if (lower === 'média') return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg">
      {/* Header - Score de Maturidade */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-full">
            <Brain className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Análise de Inteligência Artificial
            </h3>
            <p className="text-sm text-gray-600">{analysis.classificacao}</p>
          </div>
        </div>

        {/* Badge de Score */}
        <div
          className={`px-4 py-2 rounded-full border-2 ${getScoreBadgeColor(
            analysis.score_maturidade
          )}`}
        >
          <span className="text-2xl font-bold">
            {analysis.score_maturidade}
          </span>
          <span className="text-sm">/10</span>
        </div>
      </div>

      {/* Alerta Crítico - Gap e Perda */}
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-900 mb-2">Gap Crítico</h4>
            <p className="text-red-800 mb-3">{analysis.gap_critico}</p>

            <div className="flex items-center gap-2 bg-red-100 px-3 py-2 rounded-md">
              <DollarSign className="w-5 h-5 text-red-700" />
              <span className="text-sm font-semibold text-red-900">
                Perda Estimada: {analysis.perda_estimada_mensal}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Icebreaker WhatsApp */}
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <MessageCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-green-900">
                Icebreaker WhatsApp
              </h4>
              <button
                onClick={() =>
                  copyToClipboard(analysis.icebreaker_whatsapp, 'Icebreaker')
                }
                className="flex items-center gap-1 text-xs px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <Copy className="w-3 h-3" />
                Copiar
              </button>
            </div>
            <p className="text-green-800 whitespace-pre-line">
              {analysis.icebreaker_whatsapp}
            </p>
          </div>
        </div>
      </div>

      {/* Pitch Comercial */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-blue-900">Pitch Comercial</h4>
              <button
                onClick={() =>
                  copyToClipboard(analysis.pitch_comercial, 'Pitch')
                }
                className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Copy className="w-3 h-3" />
                Copiar
              </button>
            </div>
            <p className="text-blue-800 whitespace-pre-line">
              {analysis.pitch_comercial}
            </p>
          </div>
        </div>
      </div>

      {/* Objeção e Resposta */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Objeção Prevista */}
        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <h4 className="font-semibold text-orange-900 text-sm">
              Objeção Prevista
            </h4>
          </div>
          <p className="text-sm text-orange-800">{analysis.objecao_prevista}</p>
        </div>

        {/* Resposta à Objeção */}
        <div className="bg-teal-50 border-2 border-teal-200 rounded-lg p-4">
          <div className="flex items-start gap-2 mb-2">
            <Lightbulb className="w-5 h-5 text-teal-600 flex-shrink-0" />
            <h4 className="font-semibold text-teal-900 text-sm">
              Resposta Sugerida
            </h4>
          </div>
          <p className="text-sm text-teal-800">{analysis.resposta_objecao}</p>
        </div>
      </div>

      {/* Próximos Passos */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Target className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-3">
              Próximos Passos
            </h4>
            <ul className="space-y-2">
              {analysis.proximos_passos.map((passo, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">{passo}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Footer - Probabilidade de Fechamento */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Probabilidade de Fechamento:
          </span>
          <span
            className={`text-lg ${getProbabilityColor(
              analysis.probabilidade_fechamento
            )}`}
          >
            {analysis.probabilidade_fechamento}
          </span>
        </div>
      </div>
    </div>
  );
}
