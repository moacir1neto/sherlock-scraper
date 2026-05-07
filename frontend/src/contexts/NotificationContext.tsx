import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Notification, BusinessEvent } from '@/types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const MAX_NOTIFICATIONS = 50;
const SSE_RECONNECT_DELAY_MS = 5000;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => {
      const exists = prev.some(n => n.id === notification.id);
      if (exists) return prev;
      
      const updated = [notification, ...prev];
      return updated.slice(0, MAX_NOTIFICATIONS);
    });

    // Disparar Toast Visual
    showNotificationToast(notification);
  }, []);

  const showNotificationToast = (n: Notification) => {
    switch (n.type) {
      case 'MEETING_SCHEDULED':
        toast.success(`📅 ${n.title}: ${n.message}`, { duration: 6000, position: 'top-right' });
        break;
      case 'MEETING_REMINDER':
        toast.error(`⏰ LEMBRETE: ${n.message}`, { icon: '🔔', duration: 8000, position: 'top-right' });
        break;
      case 'MEETING_CANCELED':
        toast.error(`❌ REUNIÃO CANCELADA: ${n.message}`, { duration: 5000, position: 'top-right' });
        break;
      default:
        toast(n.message, { icon: 'ℹ️', position: 'top-right' });
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const connectSSE = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Conectar ao WhatsMiau SSE (que emite eventos de negócio e kanban)
    const apiUrl = (import.meta.env.VITE_WHATSMEOW_API_URL as string) || 'http://localhost:8081';
    const url = `${apiUrl}/v1/admin/leads/events?token=${encodeURIComponent(token)}`;

    if (esRef.current) esRef.current.close();
    
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        
        // Tratar BusinessEvent (Onda 3)
        if (['MEETING_SCHEDULED', 'MEETING_REMINDER', 'MEETING_CANCELED'].includes(data.type)) {
          const event = data as BusinessEvent['payload']; // No WhatsMiau SSE, o payload já vem "flat"
          
          const newNotif: Notification = {
            id: Math.random().toString(36).substr(2, 9), // ID temporário para UI
            type: data.type,
            title: getTitleByType(data.type),
            message: `${event.lead_name} - ${new Date(event.scheduled_at).toLocaleString()}`,
            read: false,
            createdAt: new Date().toISOString(),
            leadId: event.lead_id,
            data: event
          };
          addNotification(newNotif);
        }
      } catch (err) {
        console.error('Failed to parse SSE notification:', err);
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setTimeout(connectSSE, SSE_RECONNECT_DELAY_MS);
    };
  }, [addNotification]);

  useEffect(() => {
    connectSSE();
    return () => esRef.current?.close();
  }, [connectSSE]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationCenter = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationCenter must be used within a NotificationProvider');
  }
  return context;
};

function getTitleByType(type: string): string {
  switch (type) {
    case 'MEETING_SCHEDULED': return 'Reunião Agendada';
    case 'MEETING_REMINDER': return 'Lembrete de Reunião';
    case 'MEETING_CANCELED': return 'Reunião Cancelada';
    default: return 'Notificação';
  }
}
