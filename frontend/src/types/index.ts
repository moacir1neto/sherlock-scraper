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
  | 'perdido'
  | string;

export type EnrichmentStatus = 'CAPTURADO' | 'ENRIQUECENDO' | 'ENRIQUECIDO';

export type AISkill = 'raiox' | 'email' | 'call';

export interface AIAnalysis {
  skill_used: AISkill;
  score_maturidade: number;
  classificacao: string;
  gap_critico?: string;
  perda_estimada_mensal?: string;
  icebreaker_whatsapp?: string;
  pitch_comercial?: string;
  objecao_prevista?: string;
  resposta_objecao?: string;
  probabilidade_fechamento: string;
  proximos_passos: string[];
  // Skill: email
  email_subject?: string;
  email_body?: string;
  // Skill: call
  call_script?: string;
  gatekeeper_bypass?: string;
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
  estimated_value?: number;
  due_date?: string;
  tags?: string;
  linked_lead_id?: string;
}

export interface CreateLeadPayload {
  company_name: string;
  stage_id: string;
  nicho?: string;
  estimated_value?: number;
  due_date?: string;
  tags?: string;
  linked_lead_id?: string;
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

export interface AIPipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
}

export interface AIPipelineResponse {
  id: string;
  name: string;
  pipeline_name?: string;
  stages: AIPipelineStage[];
}

export interface PipelineSummary {
  id: string;
  name: string;
  stages: AIPipelineStage[];
  lead_count: number;
  created_at: string;
}
