import { useState } from 'react';
import { X, AlertCircle, Copy, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';

interface DebugLog {
  id: string;
  timestamp: Date;
  type: 'error' | 'warning' | 'info';
  message: string;
  details?: any;
  stack?: string;
}

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: DebugLog[];
  onClear: () => void;
}

export function DebugModal({ isOpen, onClose, logs, onClear }: DebugModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, logId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(logId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLogColor = (type: DebugLog['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      default:
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  const formatTimestamp = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-yellow-600 dark:text-yellow-400" size={24} />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Console de Debug - Modo Desenvolvimento
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={onClear}
                disabled={logs.length === 0}
              >
                <Trash2 size={16} className="mr-2" />
                Limpar
              </Button>
              <Button variant="ghost" onClick={onClose}>
                <X size={20} />
              </Button>
            </div>
          </div>

          {/* Logs */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Nenhum log registrado ainda
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded-lg border ${getLogColor(log.type)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <span className="text-xs font-semibold uppercase">
                          {log.type}
                        </span>
                      </div>
                      <p className="text-sm font-medium mb-1">{log.message}</p>
                      {log.details && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                            Detalhes
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-900 dark:bg-black text-green-400 p-2 rounded overflow-auto max-h-40">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                      {log.stack && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                            Stack Trace
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-900 dark:bg-black text-red-400 p-2 rounded overflow-auto max-h-40">
                            {log.stack}
                          </pre>
                        </details>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const logText = JSON.stringify(
                          {
                            timestamp: log.timestamp.toISOString(),
                            type: log.type,
                            message: log.message,
                            details: log.details,
                            stack: log.stack,
                          },
                          null,
                          2
                        );
                        copyToClipboard(logText, log.id);
                      }}
                    >
                      <Copy size={14} />
                      {copiedId === log.id ? 'Copiado!' : ''}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Total de logs: {logs.length}
            </span>
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

