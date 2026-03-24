import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { DebugModal } from '../components/DebugModal';
import { useDebugLog } from '../hooks/useDebugLog';
import { setDebugLogFn } from '../services/auth';
import { motion } from 'framer-motion';
import { LogIn, Zap, Shield, User, Bug } from 'lucide-react';

// Modo de desenvolvimento - sempre ativo em ambiente local
// Sempre mostra os botões de acesso rápido
const IS_DEV_MODE = true; // Sempre ativo em ambiente local

// Usuários de desenvolvimento fixos
const DEV_USERS = {
  super_admin: {
    email: 'superadmin@admin.com',
    password: 'admin123',
    label: 'Super Admin',
    icon: Shield,
    color: 'bg-purple-600 hover:bg-purple-700',
  },
  admin: {
    email: 'admin@admin.com',
    password: 'admin123',
    label: 'Admin',
    icon: Shield,
    color: 'bg-blue-600 hover:bg-blue-700',
  },
  user: {
    email: 'user@admin.com',
    password: 'admin123',
    label: 'Usuário',
    icon: User,
    color: 'bg-green-600 hover:bg-green-700',
  },
};

export function Login() {
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickLoginLoading, setQuickLoginLoading] = useState<string | null>(null);
  const debugLog = useDebugLog();

  // Configurar função de debug para o authService
  useEffect(() => {
    setDebugLogFn(debugLog.addLog);
  }, [debugLog.addLog]);

  // Resetar estado quando o componente é montado ou quando não está autenticado
  useEffect(() => {
    if (!isAuthenticated) {
      setEmail('');
      setPassword('');
      setLoading(false);
      setQuickLoginLoading(null);
    }
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    debugLog.addLog({
      type: 'info',
      message: 'Submissão do formulário de login',
      details: {
        email,
        passwordLength: password.length,
        timestamp: new Date().toISOString(),
      },
    });

    try {
      await login(email, password);
    } catch (error: any) {
      debugLog.addLog({
        type: 'error',
        message: 'Erro no login via formulário',
        details: {
          email,
          error: error.response?.data || error.message,
          status: error.response?.status,
        },
        stack: error.stack,
      });
      // Error is handled by AuthContext
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (userType: keyof typeof DEV_USERS) => {
    // Prevenir múltiplos cliques
    if (loading || quickLoginLoading !== null) {
      return;
    }

    const user = DEV_USERS[userType];
    setQuickLoginLoading(userType);
    setEmail(user.email);
    setPassword(user.password);
    
    debugLog.addLog({
      type: 'info',
      message: `Login rápido: ${user.label}`,
      details: {
        userType,
        email: user.email,
        passwordLength: user.password.length,
      },
    });
    
    try {
      await login(user.email, user.password);
      // Limpar estado após login bem-sucedido
      setQuickLoginLoading(null);
    } catch (error: any) {
      debugLog.addLog({
        type: 'error',
        message: `Erro no login rápido: ${user.label}`,
        details: {
          userType,
          email: user.email,
          error: error.response?.data || error.message,
          status: error.response?.status,
        },
        stack: error.stack,
      });
      // Error is handled by AuthContext
      setQuickLoginLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4">
            <LogIn className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Super Admin</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Faça login para continuar</p>
        </div>

        {/* Botões de Acesso Rápido - Apenas em Desenvolvimento */}
        {IS_DEV_MODE && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="text-yellow-600 dark:text-yellow-400" size={18} />
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                Modo Desenvolvimento - Acesso Rápido
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(DEV_USERS).map(([key, user]) => {
                const Icon = user.icon;
                return (
                  <button
                    key={key}
                    onClick={() => handleQuickLogin(key as keyof typeof DEV_USERS)}
                    disabled={loading || quickLoginLoading !== null}
                    className={`
                      ${user.color}
                      text-white text-xs font-medium py-2 px-3 rounded-lg
                      transition-all duration-200
                      disabled:opacity-50 disabled:cursor-not-allowed
                      flex flex-col items-center gap-1
                      shadow-sm hover:shadow-md
                    `}
                  >
                    {quickLoginLoading === key ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Icon size={16} />
                        <span>{user.label}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-2 text-center">
              Email: {quickLoginLoading ? DEV_USERS[quickLoginLoading as keyof typeof DEV_USERS].email : 'clique no botão'}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" disabled={loading || quickLoginLoading !== null} className="w-full">
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        {/* Botão de Debug - Apenas em Desenvolvimento */}
        {IS_DEV_MODE && debugLog.logs.length > 0 && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={debugLog.openModal}
              className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <Bug size={14} />
              Debug ({debugLog.logs.length})
            </button>
          </div>
        )}
      </motion.div>

      {/* Modal de Debug */}
      {IS_DEV_MODE && (
        <DebugModal
          isOpen={debugLog.isOpen}
          onClose={debugLog.closeModal}
          logs={debugLog.logs}
          onClear={debugLog.clearLogs}
        />
      )}
    </div>
  );
}

