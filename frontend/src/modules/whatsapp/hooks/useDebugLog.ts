import { useState, useCallback } from 'react';

export interface DebugLog {
  id: string;
  timestamp: Date;
  type: 'error' | 'warning' | 'info';
  message: string;
  details?: any;
  stack?: string;
}

const MAX_LOGS = 100;

export function useDebugLog() {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const addLog = useCallback((log: Omit<DebugLog, 'id' | 'timestamp'>) => {
    const newLog: DebugLog = {
      ...log,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    setLogs((prev) => {
      const updated = [newLog, ...prev];
      // Manter apenas os últimos MAX_LOGS
      return updated.slice(0, MAX_LOGS);
    });

    // Abrir modal automaticamente se for erro
    if (log.type === 'error') {
      setIsOpen(true);
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    logs,
    isOpen,
    addLog,
    clearLogs,
    openModal,
    closeModal,
  };
}

