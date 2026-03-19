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
  Nota: string;
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
}
