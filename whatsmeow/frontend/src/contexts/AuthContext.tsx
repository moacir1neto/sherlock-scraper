import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { AuthUser } from '../types';
import { toast } from 'react-hot-toast';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: AuthUser) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const storedUser = authService.getUser();
      if (storedUser && authService.isAuthenticated()) {
        setUser(storedUser);
      }
    } catch (error) {
      console.error('Error loading user from storage:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login({ email, password });
      authService.setAuth(response.token, response.user);
      setUser(response.user);
      toast.success('Login realizado com sucesso!');
      setTimeout(() => {
        // Todos os usuários vão para o Dashboard após login
        navigate('/dashboard');
      }, 100);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Erro ao fazer login';
      toast.error(errorMessage);
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    // Navegar imediatamente sem delay para garantir limpeza de estado
    navigate('/login', { replace: true });
    toast.success('Logout realizado com sucesso!');
  };

  const updateUser = (updatedUser: AuthUser) => {
    setUser(updatedUser);
    // Atualizar também no localStorage
    authService.setAuth(authService.getToken() || '', updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        setUser: updateUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

