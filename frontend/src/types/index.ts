export type KanbanStatus =
  | 'prospeccao'
  | 'contatado'
  | 'reuniao_agendada'
  | 'negociacao'
  | 'ganho'
  | 'perdido';

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
  KanbanStatus: KanbanStatus;
  NotasProspeccao?: string;
  ScrapingJobID?: string;
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
