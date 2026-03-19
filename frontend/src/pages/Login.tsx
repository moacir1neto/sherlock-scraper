import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const response = await axios.post(`${apiUrl}/auth/login`, {
        email,
        password,
      });
      login(response.data.token);
      navigate('/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Authentication Failed');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#09090b] relative overflow-hidden">
      {/* Background ambient glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm p-8 rounded-3xl bg-glass border border-glass-border backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative z-10"
      >
        <div className="mb-10 text-center">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-12 h-12 bg-white rounded-full mx-auto mb-6 shadow-[0_0_30px_rgba(255,255,255,0.3)] flex items-center justify-center"
          >
            {/* Minimalist Logo Icon */}
            <div className="w-5 h-5 border-[3px] border-black rounded-sm"></div>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-semibold text-white tracking-tight"
          >
            Access Workspace
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-400 mt-2 text-sm tracking-wide"
          >
            B2B Premium CRM Suite
          </motion.p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-medium text-center"
            >
              {error}
            </motion.div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold tracking-wider text-gray-400 uppercase block mb-2">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/50 focus:border-white/50 transition-all font-medium"
                placeholder="name@company.com"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold tracking-wider text-gray-400 uppercase block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/50 focus:border-white/50 transition-all font-medium"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-white text-black font-semibold rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 border-t-2 border-b-2 border-black rounded-full" viewBox="0 0 24 24"></svg>
            ) : (
              'Sign In ➔'
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
