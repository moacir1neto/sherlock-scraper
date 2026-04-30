import React, { createContext, useCallback, useContext, useState } from 'react';

export interface AppNotification {
  id: string;
  type: 'new_message' | 'new_chat_aguardando' | 'reuniao_agendada';
  title: string;
  body?: string;
  chatId?: string;
  instanceId?: string;
  chatName?: string;
  createdAt: string;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  addNotification: (n: Omit<AppNotification, 'id' | 'createdAt'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'createdAt'>) => {
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const created: AppNotification = {
      ...n,
      id,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [created, ...prev].slice(0, 50));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  React.useEffect(() => {
    const handleGlobalNotification = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const payload = customEvent.detail;
        addNotification({
          type: payload.type || 'new_message',
          title: payload.title,
          body: payload.body || payload.message,
          chatId: payload.chatId || payload.leadId,
          chatName: payload.chatName,
          instanceId: payload.instanceId,
        });
      }
    };
    window.addEventListener('app_notification', handleGlobalNotification);
    return () => window.removeEventListener('app_notification', handleGlobalNotification);
  }, [addNotification]);

  const value: NotificationContextValue = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) return null;
  return ctx;
}
