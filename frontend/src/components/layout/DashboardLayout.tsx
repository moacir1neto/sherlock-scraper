import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Menu, X, Zap, Database, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { name: 'Raspagens', path: '/dashboard/raspagens', icon: Zap },
    { name: 'Minhas Listas', path: '/dashboard/listas', icon: Database },
    { name: 'Configurações', path: '/dashboard/configuracoes', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#09090b] text-white overflow-hidden selection:bg-blue-500/30">
      <Toaster position="top-right" toastOptions={{ style: { background: '#18181b', color: '#fff', border: '1px solid #27272a' } }} />
      
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarOpen ? 260 : 80 }}
        className="h-full bg-black/40 border-r border-glass-border backdrop-blur-md flex flex-col transition-all duration-300 relative z-20 shrink-0"
      >
        <div className="h-20 flex items-center justify-between px-6 border-b border-glass-border">
          {sidebarOpen && <span className="text-xl font-bold tracking-tight text-white whitespace-nowrap">Sherlock CRM</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-auto">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2">
          {navLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `flex items-center px-3 py-3 rounded-xl transition-all whitespace-nowrap overflow-hidden ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <link.icon size={22} className="shrink-0" />
              {sidebarOpen && <span className="ml-4 font-medium">{link.name}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-glass-border">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-3 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-colors whitespace-nowrap overflow-hidden"
          >
            <LogOut size={22} className="shrink-0" />
            {sidebarOpen && <span className="ml-4 font-medium">Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Background ambient glow effect */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none"></div>
        
        {/* Header */}
        <header className="h-20 flex items-center justify-end px-8 border-b border-glass-border bg-black/20 backdrop-blur-sm z-10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user?.email || 'Admin User'}</p>
              <p className="text-xs text-gray-500">Premium Member</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg">
              {user?.email ? user.email.charAt(0).toUpperCase() : 'A'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-8 z-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
