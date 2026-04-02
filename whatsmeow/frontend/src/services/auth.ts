import axios from 'axios';
import { LoginRequest, LoginResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/v1';
const IS_DEV = import.meta.env.DEV || window.location.hostname === 'localhost';

// Função para adicionar log de debug (será injetada pelo App)
let debugLogFn: ((log: { type: 'error' | 'warning' | 'info'; message: string; details?: any; stack?: string }) => void) | null = null;

export const setDebugLogFn = (fn: typeof debugLogFn) => {
  debugLogFn = fn;
};

const authApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Interceptor de requisição para log
authApi.interceptors.request.use(
  (config) => {
    if (IS_DEV && debugLogFn) {
      debugLogFn({
        type: 'info',
        message: `Requisição: ${config.method?.toUpperCase()} ${config.url}`,
        details: {
          url: config.url,
          method: config.method,
          headers: config.headers,
          data: config.data,
        },
      });
    }
    return config;
  },
  (error) => {
    if (IS_DEV && debugLogFn) {
      debugLogFn({
        type: 'error',
        message: 'Erro na requisição',
        details: error,
        stack: error.stack,
      });
    }
    return Promise.reject(error);
  }
);

// Interceptor de resposta para log
authApi.interceptors.response.use(
  (response) => {
    if (IS_DEV && debugLogFn) {
      debugLogFn({
        type: 'info',
        message: `Resposta: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`,
        details: {
          status: response.status,
          data: response.data,
        },
      });
    }
    return response;
  },
  (error) => {
    if (IS_DEV && debugLogFn) {
      debugLogFn({
        type: 'error',
        message: `Erro na resposta: ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        details: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          code: error.code,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers,
            data: error.config?.data,
          },
        },
        stack: error.stack,
      });
    }

    if (error.code === 'ECONNABORTED') {
      error.message = 'Tempo limite excedido. Tente novamente.';
    } else if (!error.response) {
      error.message = 'Erro de conexão. Verifique sua internet.';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    if (IS_DEV && debugLogFn) {
      debugLogFn({
        type: 'info',
        message: 'Tentativa de login',
        details: {
          email: credentials.email,
          passwordLength: credentials.password?.length || 0,
          hasPassword: !!credentials.password,
        },
      });
    }

    try {
      const response = await authApi.post<LoginResponse>('/auth/login', credentials);
      
      if (IS_DEV && debugLogFn) {
        debugLogFn({
          type: 'info',
          message: 'Login bem-sucedido',
          details: {
            hasToken: !!response.data.token,
            tokenLength: response.data.token?.length || 0,
            user: response.data.user,
          },
        });
      }

      return response.data;
    } catch (error: any) {
      if (IS_DEV && debugLogFn) {
        debugLogFn({
          type: 'error',
          message: 'Erro no login',
          details: {
            email: credentials.email,
            error: error.response?.data || error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
          },
          stack: error.stack,
        });
      }
      throw error;
    }
  },

  logout: () => {
    if (IS_DEV && debugLogFn) {
      debugLogFn({
        type: 'info',
        message: 'Logout realizado',
        details: {
          hadToken: !!localStorage.getItem('token'),
          hadUser: !!localStorage.getItem('user'),
        },
      });
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getToken: (): string | null => {
    return localStorage.getItem('token');
  },

  getUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  setAuth: (token: string, user: any) => {
    if (IS_DEV && debugLogFn) {
      debugLogFn({
        type: 'info',
        message: 'Autenticação salva',
        details: {
          tokenLength: token?.length || 0,
          hasToken: !!token,
          user: user,
        },
      });
    }
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('token');
  },
};

