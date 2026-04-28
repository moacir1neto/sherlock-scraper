import { useEffect, useState, useRef, useCallback } from 'react';
import { instanceService } from '../services/api';
import { Modal } from './Modal';
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, Wifi } from 'lucide-react';
import { Button } from './Button';
import { toast } from 'react-hot-toast';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
  onConnected?: () => void;
}

type ConnectionStage = 'idle' | 'initiating' | 'negotiating' | 'qr_ready' | 'connected' | 'error';

const STAGE_LABELS: Record<ConnectionStage, string> = {
  idle: 'Preparando...',
  initiating: 'Iniciando conexão...',
  negotiating: 'Negociando com WhatsApp...',
  qr_ready: 'Escaneie o QR Code com seu WhatsApp',
  connected: 'Conectado com sucesso!',
  error: 'Erro ao conectar',
};

const POLL_INTERVAL_MS = 1500;
const STATUS_CHECK_INTERVAL_MS = 3000;
const CONNECTION_TIMEOUT_MS = 120_000;

export function QRCodeModal({ isOpen, onClose, instanceId, onConnected }: QRCodeModalProps) {
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [stage, setStage] = useState<ConnectionStage>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearAllTimers = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (statusRef.current) { clearInterval(statusRef.current); statusRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const handleConnected = useCallback(() => {
    if (!mountedRef.current) return;
    setStage('connected');
    clearAllTimers();
    toast.success('WhatsApp conectado com sucesso!');
    onConnected?.();
    setTimeout(() => {
      if (mountedRef.current) onClose();
    }, 1500);
  }, [clearAllTimers, onConnected, onClose]);

  const pollForQRCode = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const response = await instanceService.getQRCode(instanceId);

      if (!mountedRef.current) return;

      if (response.Connected || response.Status === 'connected') {
        handleConnected();
        return;
      }

      if (response.Status === 'qr_ready' && response.Base64) {
        setQrCodeImage(response.Base64);
        setStage('qr_ready');
        setErrorMessage(null);
        return;
      }

      // Still generating — update stage feedback
      if (response.Status === 'generating') {
        setStage('negotiating');
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error('Erro ao obter QR Code:', err);
      setStage('error');
      setErrorMessage(err.message || 'Erro ao obter QR Code.');
      clearAllTimers();
    }
  }, [instanceId, handleConnected, clearAllTimers]);

  const checkConnectionStatus = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const status = await instanceService.status(instanceId);
      const state = status.instance?.state || status.status || '';

      if (!mountedRef.current) return;

      if (state === 'open' || state === 'connected') {
        handleConnected();
      }
    } catch {
      // Silent — status check is best-effort
    }
  }, [instanceId, handleConnected]);

  const handleRetry = useCallback(() => {
    setStage('initiating');
    setErrorMessage(null);
    setQrCodeImage(null);
    pollForQRCode();
    startPolling();
  }, [pollForQRCode]);

  const startPolling = useCallback(() => {
    clearAllTimers();

    // Global timeout
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setStage('error');
      setErrorMessage('Tempo limite excedido. Tente novamente.');
      clearAllTimers();
    }, CONNECTION_TIMEOUT_MS);

    // QR polling (fast — every 1.5s)
    pollRef.current = setInterval(() => {
      if (stage !== 'connected' && stage !== 'error') {
        pollForQRCode();
      }
    }, POLL_INTERVAL_MS);

    // Status polling (slower — every 3s, catches scan events)
    statusRef.current = setInterval(() => {
      if (stage !== 'connected') {
        checkConnectionStatus();
      }
    }, STATUS_CHECK_INTERVAL_MS);
  }, [clearAllTimers, pollForQRCode, checkConnectionStatus, stage]);

  useEffect(() => {
    mountedRef.current = true;

    if (!isOpen || !instanceId) {
      clearAllTimers();
      return;
    }

    // Reset state
    setQrCodeImage(null);
    setStage('initiating');
    setErrorMessage(null);

    // Initial call + start polling
    pollForQRCode();
    startPolling();

    return () => {
      mountedRef.current = false;
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, instanceId]);

  const isLoading = stage === 'idle' || stage === 'initiating' || stage === 'negotiating';
  const hasError = stage === 'error';
  const hasQR = stage === 'qr_ready' && !!qrCodeImage;
  const isConnected = stage === 'connected';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Conectar WhatsApp" size="sm">
      <div className="flex flex-col items-center space-y-4 py-4">
        {/* Loading State */}
        {isLoading && !hasError && (
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <Loader2 className="animate-spin text-primary-500 dark:text-primary-400" size={48} />
              {stage === 'negotiating' && (
                <Wifi className="absolute -top-1 -right-1 text-blue-500 animate-pulse" size={18} />
              )}
            </div>
            <p className="text-gray-700 dark:text-gray-300 font-medium">{STAGE_LABELS[stage]}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Isso geralmente leva de 2 a 5 segundos
            </p>
          </div>
        )}

        {/* Error State */}
        {hasError && (
          <div className="flex flex-col items-center space-y-4 w-full">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 w-full">
              <div className="flex items-start space-x-3">
                <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">{errorMessage}</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Verifique se a instância foi criada corretamente e tente novamente.
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={handleRetry} variant="primary" className="w-full">
              <RefreshCw size={16} className="mr-2" />
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* QR Code Display */}
        {hasQR && !isConnected && (
          <>
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 flex justify-center shadow-sm">
              <img 
                src={qrCodeImage} 
                alt="QR Code WhatsApp" 
                className="max-w-full h-auto"
                style={{ maxWidth: '280px' }}
              />
            </div>
            <div className="text-center space-y-2 w-full">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{STAGE_LABELS[stage]}</p>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-left">
                <p className="text-xs text-blue-800 dark:text-blue-300 font-medium mb-1">Como conectar:</p>
                <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                  <li>Abra o WhatsApp no seu celular</li>
                  <li>Toque em <strong>Configurações</strong> (⚙️)</li>
                  <li>Toque em <strong>Aparelhos conectados</strong></li>
                  <li>Toque em <strong>Conectar um aparelho</strong></li>
                  <li>Escaneie este QR Code</li>
                </ol>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                O QR Code é atualizado automaticamente
              </p>
            </div>
          </>
        )}
        
        {/* Connected State */}
        {isConnected && (
          <div className="text-center py-6 space-y-4">
            <div className="inline-block bg-green-100 dark:bg-green-900/30 rounded-full p-4">
              <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">Conectado com sucesso!</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Seu WhatsApp está pronto para uso.</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
