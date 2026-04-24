import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL || '/v1';
const API_BASE_URL =
  !rawApiUrl || rawApiUrl.endsWith('/v1')
    ? rawApiUrl || '/v1'
    : rawApiUrl.replace(/\/+$/, '') + '/v1';
const API_KEY = import.meta.env.VITE_API_KEY || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(API_KEY && { apikey: API_KEY }),
  },
  timeout: 30000, // 30 segundos
});

// --- Lógica de Interceptores Reutilizável ---
const applyInterceptors = (instance: any, name: string) => {
  // Injeção de Token JWT
  instance.interceptors.request.use(
    (config: any) => {
      const token = localStorage.getItem('token');
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Log de debug (opcional)
      console.log(`🚀 [${name}] Request:`, {
        method: config.method,
        url: config.url,
        baseUrl: config.baseURL
      });
      
      return config;
    },
    (error: any) => Promise.reject(error)
  );

  // Tratamento de Resposta e Erros Globais (401 Unauthorized)
  instance.interceptors.response.use(
    (response: any) => response,
    (error: any) => {
      const status = error.response?.status;
      
      console.error(`❌ [${name}] API Error:`, {
        status,
        message: error.message,
        url: error.config?.url
      });

      if (status === 401 && name !== 'Sherlock') {
        console.warn(`⚠️ Sessão expirada na instância [${name}]. Redirecionando...`);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else if (status === 401) {
        console.error(`🚫 [${name}] Auth Error (Bypassed logout): Ocorreu um erro 401, mas o logout foi impedido.`);
      }

      if (error.code === 'ECONNABORTED') {
        error.message = 'Tempo limite excedido. Tente novamente.';
      } else if (!error.response) {
        error.message = 'Erro de conexão. Verifique sua internet.';
      }

      return Promise.reject(error);
    }
  );
};

// Aplicar interceptores nas instâncias
applyInterceptors(api, 'WhatsMiau');

const SHERLOCK_API_URL = (import.meta.env.VITE_SHERLOCK_API_URL || 'http://localhost:3005/api/v1').replace(/\/+$/, '');

export const sherlockApi = axios.create({
  baseURL: SHERLOCK_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, 
});
applyInterceptors(sherlockApi, 'Sherlock');
// --------------------------------------------

export const instanceService = {
  list: async () => {
    const response = await api.get('/instance');
    return response.data;
  },

  create: async (instanceName: string) => {
    const response = await api.post('/instance', { instanceName });
    return response.data;
  },

  connect: async (instanceId: string) => {
    const response = await api.post(`/instance/${instanceId}/connect`, {
      id: instanceId,
    });
    return response.data;
  },

  getQRCode: async (instanceId: string): Promise<{ Status: string; Base64?: string; Connected: boolean; Message?: string }> => {
    try {
      const response = await api.post(`/instance/${instanceId}/connect`, {
        id: instanceId,
      }, { timeout: 10000 }); // Short timeout — backend responds fast now

      return {
        Status: response.data.status || (response.data.Connected ? 'connected' : 'generating'),
        Base64: response.data.Base64 || response.data.base64,
        Connected: !!response.data.Connected || !!response.data.connected,
        Message: response.data.Message || response.data.message,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Instância não encontrada. Certifique-se de que a instância foi criada corretamente.');
      }
      const errorMessage = error.response?.data?.message || error.message || 'Erro ao obter QR Code';
      throw new Error(errorMessage);
    }
  },

  status: async (instanceId: string) => {
    try {
      const response = await api.get(`/instance/${instanceId}/status`);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao obter status:', error);
      throw error;
    }
  },

  logout: async (instanceId: string) => {
    const response = await api.post(`/instance/${instanceId}/logout`);
    return response.data;
  },

  delete: async (instanceId: string) => {
    const response = await api.delete(`/instance/${instanceId}`);
    return response.data;
  },

  update: async (instanceId: string, payload: { displayName?: string }) => {
    const response = await api.put(`/instance/update/${instanceId}`, { id: instanceId, displayName: payload.displayName ?? '' });
    return response.data;
  },

  getInstanceUsers: async (instanceId: string): Promise<{ user_ids: string[] }> => {
    const response = await api.get<{ user_ids: string[] }>(`/instance/${instanceId}/users`);
    return response.data;
  },

  setInstanceUsers: async (instanceId: string, userIds: string[]) => {
    const response = await api.put<{ user_ids: string[] }>(`/instance/${instanceId}/users`, { user_ids: userIds });
    return response.data;
  },

  updateWebhook: async (
    instanceId: string,
    webhook: { url?: string; secret?: string; events?: string[]; base64?: boolean }
  ) => {
    const body: any = {
      id: instanceId,
      webhook: {
        url: webhook.url ?? '',
        events: webhook.events ?? [],
        base64: webhook.base64 ?? false,
      },
    };
    if (webhook.secret !== undefined && webhook.secret !== '') {
      body.webhook.secret = webhook.secret;
    }
    const response = await api.put(`/instance/update/${instanceId}`, body);
    return response.data;
  },

  webhookSendTest: async (instanceId: string) => {
    const response = await api.post(`/instance/${instanceId}/webhook-send-test`);
    return response.data;
  },
};

export const messageService = {
  sendText: async (
    instanceId: string,
    number: string,
    text: string,
    quoted?: { key: { id: string; remoteJid: string; fromMe: boolean }; message: { conversation: string } }
  ) => {
    const cleanNumber = number.trim().replace(/[^\d+]/g, '');
    if (!cleanNumber || cleanNumber.length < 10) {
      throw new Error('Número inválido. Use o formato: 5511999999999');
    }
    if (!text || text.trim().length === 0) {
      throw new Error('A mensagem não pode estar vazia');
    }
    const payload: { number: string; text: string; quoted?: typeof quoted } = {
      number: cleanNumber,
      text: text.trim(),
    };
    if (quoted?.key?.id) {
      payload.quoted = {
        key: { id: quoted.key.id, remoteJid: quoted.key.remoteJid, fromMe: quoted.key.fromMe },
        message: { conversation: quoted.message?.conversation ?? '' },
      };
    }
    const response = await api.post(`/instance/${instanceId}/message/text`, payload);
    return response.data;
  },

  sendReaction: async (
    instanceId: string,
    key: { remoteJid: string; id: string; fromMe: boolean; participant?: string },
    reaction: string
  ) => {
    const payload: { key: { remoteJid: string; id: string; fromMe: boolean; participant?: string }; reaction: string } = {
      key: { remoteJid: key.remoteJid, id: key.id, fromMe: key.fromMe },
      reaction,
    };
    if (key.participant) payload.key.participant = key.participant;
    const response = await api.post(`/instance/${instanceId}/message/reaction`, payload);
    return response.data;
  },

  revokeMessage: async (
    instanceId: string,
    key: { remoteJid: string; id: string; fromMe: boolean }
  ) => {
    const response = await api.post(`/instance/${instanceId}/message/revoke`, {
      key: { remoteJid: key.remoteJid, id: key.id, fromMe: key.fromMe },
    });
    return response.data;
  },

  editMessage: async (
    instanceId: string,
    key: { remoteJid: string; id: string },
    text: string
  ) => {
    const response = await api.post(`/instance/${instanceId}/message/edit`, {
      key: { remoteJid: key.remoteJid, id: key.id },
      text,
    });
    return response.data;
  },

  sendImage: async (instanceId: string, number: string, media: string, caption?: string) => {
    // Validação da URL
    const cleanMedia = media.trim();
    if (!cleanMedia) {
      throw new Error('URL da imagem é obrigatória');
    }
    
    if (!cleanMedia.startsWith('http://') && !cleanMedia.startsWith('https://')) {
      throw new Error('URL inválida. Use http:// ou https://');
    }
    
    // Limpa o número também
    const cleanNumber = number.trim().replace(/[^\d+]/g, '');
    
    const payload = {
      number: cleanNumber,
      media: cleanMedia,
      mimetype: 'image/jpeg',
      caption: caption || '',
    };
    
    console.log('Enviando imagem:', { instanceId, payload });
    
    try {
      const response = await api.post(`/instance/${instanceId}/message/image`, payload);
      console.log('Resposta da imagem:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao enviar imagem:', error);
      console.error('Payload enviado:', payload);
      console.error('Resposta do servidor:', error.response?.data);
      throw error;
    }
  },

  sendAudio: async (instanceId: string, number: string, audio: string) => {
    // Validação da URL
    const cleanAudio = audio.trim();
    if (!cleanAudio) {
      throw new Error('URL do áudio é obrigatória');
    }
    
    if (!cleanAudio.startsWith('http://') && !cleanAudio.startsWith('https://')) {
      throw new Error('URL inválida. Use http:// ou https://');
    }
    
    // Limpa o número também
    const cleanNumber = number.trim().replace(/[^\d+]/g, '');
    
    const payload = {
      number: cleanNumber,
      audio: cleanAudio,
    };
    
    console.log('Enviando áudio:', { instanceId, payload });
    
    try {
      const response = await api.post(`/instance/${instanceId}/message/audio`, payload);
      console.log('Resposta do áudio:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao enviar áudio:', error);
      console.error('Payload enviado:', payload);
      console.error('Resposta do servidor:', error.response?.data);
      throw error;
    }
  },

  sendDocument: async (instanceId: string, number: string, document: string, fileName: string) => {
    // Validação da URL
    const cleanDocument = document.trim();
    if (!cleanDocument) {
      throw new Error('URL do documento é obrigatória');
    }
    
    if (!cleanDocument.startsWith('http://') && !cleanDocument.startsWith('https://')) {
      throw new Error('URL inválida. Use http:// ou https://');
    }
    
    const cleanFileName = fileName.trim();
    if (!cleanFileName) {
      throw new Error('Nome do arquivo é obrigatório');
    }
    
    // Limpa o número também
    const cleanNumber = number.trim().replace(/[^\d+]/g, '');
    
    const payload = {
      number: cleanNumber,
      media: cleanDocument,
      mimetype: 'application/pdf',
      fileName: cleanFileName,
    };
    
    console.log('Enviando documento:', { instanceId, payload });
    
    try {
      const response = await api.post(`/instance/${instanceId}/message/document`, payload);
      console.log('Resposta do documento:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao enviar documento:', error);
      console.error('Payload enviado:', payload);
      console.error('Resposta do servidor:', error.response?.data);
      throw error;
    }
  },
};

export const chatService = {
  getChats: async (instanceId: string, limit: number = 50) => {
    const response = await api.get(`/instance/${instanceId}/chats`, { params: { limit } });
    return response.data;
  },

  getMessages: async (
    instanceId: string,
    chatId: string,
    params?: { limit?: number; before_id?: string }
  ) => {
    const response = await api.get(`/instance/${instanceId}/chats/${chatId}/messages`, { params: params || {} });
    return response.data;
  },

  /** Retorna a foto de perfil como Blob, ou null se não houver/erro. Use URL.createObjectURL(blob) para exibir em <img>. */
  getProfilePicture: async (instanceId: string, jid: string): Promise<Blob | null> => {
    try {
      const response = await api.get(`/instance/${instanceId}/profile-picture`, {
        params: { jid },
        responseType: 'blob',
      });
      return response.data instanceof Blob ? response.data : null;
    } catch {
      return null;
    }
  },

  /** Retorna o blob da mídia da mensagem quando media_url é "local:...". Use URL.createObjectURL(blob) para exibir. */
  getMessageMedia: async (
    instanceId: string,
    chatId: string,
    messageId: string
  ): Promise<Blob | null> => {
    try {
      const response = await api.get(
        `/instance/${instanceId}/chats/${chatId}/messages/${messageId}/media`,
        { responseType: 'blob' }
      );
      return response.data instanceof Blob ? response.data : null;
    } catch {
      return null;
    }
  },

  sendPresence: async (instanceId: string, number: string) => {
    const response = await api.post(`/instance/${instanceId}/chat/presence`, {
      number,
      presence: 'composing',
      type: 'text',
    });
    return response.data;
  },

  readMessages: async (instanceId: string, number: string, messageId: string) => {
    const response = await api.post(`/instance/${instanceId}/chat/read-messages`, {
      readMessages: [
        {
          remoteJid: number,
          id: messageId,
        },
      ],
    });
    return response.data;
  },

  checkNumbers: async (instanceId: string, numbers: string[]) => {
    const response = await api.post(`/chat/whatsappNumbers/${instanceId}`, {
      numbers,
    });
    return response.data;
  },
};

export const webhookService = {
  listLogs: async (params?: {
    instance_id?: string;
    company_id?: string;
    event_type?: string;
    limit?: number;
    offset?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.instance_id) searchParams.set('instance_id', params.instance_id);
    if (params?.company_id) searchParams.set('company_id', params.company_id);
    if (params?.event_type) searchParams.set('event_type', params.event_type);
    if (params?.limit != null) searchParams.set('limit', String(params.limit));
    if (params?.offset != null) searchParams.set('offset', String(params.offset));
    const q = searchParams.toString();
    const response = await api.get(`/admin/webhook-logs${q ? `?${q}` : ''}`);
    return response.data as { items: any[]; total: number };
  },

  getLogById: async (id: string) => {
    const response = await api.get(`/admin/webhook-logs/${id}`);
    return response.data;
  },
};

export const sectorService = {
  list: async (): Promise<any[]> => {
    const response = await api.get('/admin/sectors');
    return response.data as any[];
  },
  create: async (data: { name: string; slug?: string }) => {
    const response = await api.post('/admin/sectors', data);
    return response.data;
  },
  update: async (id: string, data: { name: string; slug?: string }) => {
    const response = await api.put(`/admin/sectors/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/admin/sectors/${id}`);
  },
};

export const tagService = {
  list: async (companyId?: string) => {
    const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
    const response = await api.get(`/admin/tags${q}`);
    return response.data as Array<{ id: string; company_id: string; name: string; color?: string; kanban_enabled?: boolean; sort_order?: number; created_at?: string; usage_count?: number }>;
  },
  create: async (data: { name: string; color?: string; kanban_enabled?: boolean; sort_order?: number }) => {
    const response = await api.post('/admin/tags', data);
    return response.data;
  },
  update: async (id: string, data: { name: string; color?: string; kanban_enabled?: boolean; sort_order?: number }) => {
    const response = await api.put(`/admin/tags/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/admin/tags/${id}`);
  },
  listByChat: async (instanceId: string, chatId: string) => {
    const response = await api.get(`/instance/${instanceId}/chats/${chatId}/tags`);
    return response.data as Array<{ id: string; name: string; color?: string }>;
  },
  addToChat: async (instanceId: string, chatId: string, tagId: string) => {
    await api.post(`/instance/${instanceId}/chats/${chatId}/tags`, { tag_id: tagId });
  },
  removeFromChat: async (instanceId: string, chatId: string, tagId: string) => {
    await api.delete(`/instance/${instanceId}/chats/${chatId}/tags/${tagId}`);
  },
};

export const quickRepliesService = {
  list: async (companyId?: string) => {
    const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
    const response = await api.get(`/admin/quick-replies${q}`);
    return response.data as Array<{ id: string; company_id: string; command: string; message: string; created_at?: string }>;
  },
  create: async (data: { command: string; message: string }) => {
    const response = await api.post('/admin/quick-replies', data);
    return response.data;
  },
  update: async (id: string, data: { command: string; message: string }) => {
    const response = await api.put(`/admin/quick-replies/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/admin/quick-replies/${id}`);
  },
};

export const flowService = {
  list: async (companyId?: string) => {
    const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
    const response = await api.get(`/admin/flows${q}`);
    return response.data as Array<{ id: string; company_id: string; name: string; command?: string; definition?: unknown; created_at?: string; updated_at?: string }>;
  },
  get: async (id: string) => {
    const response = await api.get(`/admin/flows/${id}`);
    return response.data as { id: string; company_id: string; name: string; command?: string; definition?: unknown; created_at?: string; updated_at?: string };
  },
  create: async (data: { name: string; command: string; definition?: unknown }) => {
    const response = await api.post('/admin/flows', data);
    return response.data as { id: string; company_id: string; name: string; command?: string; definition?: unknown; created_at?: string; updated_at?: string };
  },
  update: async (id: string, data: { name: string; command: string; definition?: unknown }) => {
    const response = await api.put(`/admin/flows/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/admin/flows/${id}`);
  },
};

export const kanbanService = {
  getColumns: async (instanceId: string) => {
    const response = await api.get(`/admin/kanban?instance_id=${encodeURIComponent(instanceId)}`);
    return response.data as Array<{
      tag: { id: string; name: string; color?: string; sort_order?: number };
      chats: Array<{
        id: string;
        instance_id: string;
        remote_jid: string;
        name: string;
        last_message_preview?: string;
        last_message_at?: string;
        status?: string;
      }>;
    }>;
  },
};

export const dashboardService = {
  getStats: async (): Promise<{
    messages_today: number;
    messages_last_7_days: number[];
    chats_aguardando: number;
    chats_atendendo: number;
    chats_finalizado: number;
  }> => {
    const response = await api.get('/admin/dashboard/stats');
    return response.data as {
      messages_today: number;
      messages_last_7_days: number[];
      chats_aguardando: number;
      chats_atendendo: number;
      chats_finalizado: number;
    };
  },
};

export const auditService = {
  list: async (params?: { company_id?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.company_id) searchParams.set('company_id', params.company_id);
    if (params?.limit != null) searchParams.set('limit', String(params.limit));
    if (params?.offset != null) searchParams.set('offset', String(params.offset));
    const q = searchParams.toString();
    const response = await api.get(`/admin/audit-logs${q ? `?${q}` : ''}`);
    return response.data as { items: any[]; total: number };
  },
  getById: async (id: string) => {
    const response = await api.get(`/admin/audit-logs/${id}`);
    return response.data;
  },
};

export interface ScheduledMessageItem {
  id: string;
  company_id: string;
  instance_id: string;
  remote_jid: string;
  message_type: string;
  content: string;
  media_url?: string;
  scheduled_at: string;
  status: string;
  created_at: string;
  sent_at?: string;
  error_msg?: string;
}

export const uploadService = {
  uploadFile: async (file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post<{ url: string }>('/admin/upload', form, {
      timeout: 60000,
    });
    return response.data;
  },
};

export const scheduledMessageService = {
  list: async (): Promise<ScheduledMessageItem[]> => {
    const response = await api.get<ScheduledMessageItem[]>('/admin/scheduled-messages');
    return Array.isArray(response.data) ? response.data : [];
  },
  create: async (payload: {
    instance_id: string;
    number: string;
    message_type: 'text' | 'image' | 'audio' | 'document';
    content?: string;
    media_url?: string;
    scheduled_at: string;
  }): Promise<ScheduledMessageItem> => {
    const response = await api.post<ScheduledMessageItem>('/admin/scheduled-messages', payload);
    return response.data;
  },
  cancel: async (id: string): Promise<void> => {
    await api.delete(`/admin/scheduled-messages/${id}`);
  },
};

export { api };
export default api;

