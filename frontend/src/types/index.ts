export interface CompanySetting {
  ID: number;
  CompanyName: string;
  Niche: string;
  MainOffer: string;
  ToneOfVoice: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export type KanbanStatus =
  | 'prospeccao'
  | 'contatado'
  | 'reuniao_agendada'
  | 'negociacao'
  | 'ganho'
  | 'perdido';

export type EnrichmentStatus = 'CAPTURADO' | 'ENRIQUECENDO' | 'ENRIQUECIDO';

export interface AIAnalysis {
  score_maturidade: number;
  classificacao: string;
  gap_critico: string;
  perda_estimada_mensal: string;
  icebreaker_whatsapp: string;
  pitch_comercial: string;
  objecao_prevista: string;
  resposta_objecao: string;
  probabilidade_fechamento: string;
  proximos_passos: string[];
}

export interface Lead {
  ID: string;
  Empresa: string;
  Nicho: string;
  Rating: string;
  QtdAvaliacoes: string;
  ResumoNegocio: string;
  Endereco: string;
  Telefone: string;
  TipoTelefone: string;
  LinkWhatsapp: string;
  Site: string;
  Email: string;
  Instagram: string;
  Facebook: string;
  LinkedIn: string;
  TikTok: string;
  YouTube: string;
  TemPixel: boolean;
  TemGTM: boolean;
  Status: EnrichmentStatus;
  KanbanStatus: KanbanStatus;
  NotasProspeccao?: string;
  ScrapingJobID?: string;
  AIAnalysis?: AIAnalysis;
}

export type ScrapingStatus = 'running' | 'completed' | 'error';

export interface ScrapingJob {
  ID: string;
  Nicho: string;
  Localizacao: string;
  Status: ScrapingStatus;
  Logs: string;
  CreatedAt: string;
  UpdatedAt: string;
}
