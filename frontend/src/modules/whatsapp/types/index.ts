export interface Instance {
  instanceName: string;
  status?: 'open' | 'close' | 'connecting';
  qrcode?: {
    code: string;
    base64?: string;
  };
}

export interface Message {
  number: string;
  textMessage?: {
    text: string;
  };
  mediaMessage?: {
    media: string;
    mimetype: string;
    caption?: string;
  };
}

export interface ApiResponse<T = any> {
  status: number;
  message?: string;
  data?: T;
  error?: string;
}

export interface ConnectionStatus {
  id?: string;
  status?: string;
  instance?: {
    instanceName: string;
    state: string;
  };
}

export interface User {
  id: string;
  nome: string;
  email: string;
  role: 'super_admin' | 'admin' | 'user';
  company_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Company {
  id: string;
  nome: string;
  cnpj: string;
  email: string;
  telefone?: string;
  endereco?: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  role: 'super_admin' | 'admin' | 'user';
  company_id?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface SuperAdminInstance {
  instanceName?: string;
  id?: string;
  instance?: {
    instanceName: string;
    state: string;
  };
  status?: string;
}

export interface Incident {
  id: string;
  tenant_id?: string;
  company_id?: string;
  user_id?: string;
  instance_id?: string;
  code: string;
  message: string;
  context_type?: string;
  context_id?: string;
  request_path?: string;
  request_method?: string;
  payload_json?: string;
  error_detail?: string;
  created_at: string;
}

export interface InstanceWebhook {
  url?: string;
  secret?: string;
  events?: string[];
  base64?: boolean;
}

export interface WebhookLog {
  id: string;
  instance_id: string;
  company_id?: string;
  event_type: string;
  url: string;
  request_body?: string;
  response_status?: number;
  response_body?: string;
  error_message?: string;
  created_at: string;
}

export interface Tag {
  id: string;
  company_id: string;
  name: string;
  color?: string;
  kanban_enabled?: boolean;
  sort_order?: number;
  created_at?: string;
  usage_count?: number;
}

export interface AuditLog {
  id: string;
  company_id?: string;
  user_id?: string;
  user_email?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

