import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, Calendar, Clock, AlertCircle } from 'lucide-react';
import { useNotificationCenter } from '@/contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';

const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotificationCenter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'MEETING_SCHEDULED': return <Calendar className="text-blue-400" size={18} />;
      case 'MEETING_REMINDER': return <Clock className="text-amber-400" size={18} />;
      case 'MEETING_CANCELED': return <AlertCircle className="text-red-400" size={18} />;
      default: return <Bell className="text-gray-400" size={18} />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all relative group"
      >
        <Bell size={20} className="text-gray-300 group-hover:text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-[#09090b]">
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-80 bg-[#121214] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl"
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-semibold">Notificações</h3>
              <div className="flex gap-2">
                {notifications.length > 0 && (
                  <>
                    <button 
                      onClick={markAllAsRead} 
                      title="Marcar todas como lidas"
                      className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      onClick={clearNotifications} 
                      title="Limpar todas"
                      className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  <Bell className="mx-auto mb-3 opacity-20" size={32} />
                  <p className="text-sm">Nenhuma notificação</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={`p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer relative ${!n.read ? 'bg-blue-500/[0.03]' : ''}`}
                  >
                    {!n.read && (
                      <div className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                    )}
                    <div className="flex gap-3">
                      <div className="mt-1 shrink-0 p-2 bg-white/5 rounded-lg border border-white/5">
                        {getIcon(n.type)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white mb-0.5">{n.title}</p>
                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-gray-600 mt-2 font-mono">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 bg-white/[0.02] border-t border-white/5 text-center">
                <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
                  Ver todas as atividades
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
