import { useEffect, useState, useRef } from 'react';
import { instanceService } from '../services/api';
import { Modal } from './Modal';
import { Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';
import { toast } from 'react-hot-toast';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
  onConnected?: () => void;
}

export function QRCodeModal({ isOpen, onClose, instanceId, onConnected }: QRCodeModalProps) {
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('Iniciando conexão...');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MAX_RETRIES = 10;
  const QR_REFRESH_INTERVAL = 5000; // 5 segundos
  const STATUS_CHECK_INTERVAL = 3000; // 3 segundos
  const CONNECTION_TIMEOUT = 120000; // 2 minutos

  const clearTimers = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const fetchQRCode = async (isRetry: boolean = false) => {
    try {
      if (!isRetry) {
        setLoading(true);
        setError(null);
        setStatusMessage('Gerando QR Code...');
        setRetryCount(0);
      }
      
      const response = await instanceService.getQRCode(instanceId, 0);
      
      // Se já está conectado
      if (response.Connected) {
        setConnected(true);
        setStatusMessage('Conectado com sucesso!');
        clearTimers();
        toast.success('WhatsApp conectado com sucesso!');
        // Chama onConnected imediatamente para atualizar a lista
        onConnected?.();
        // Aguarda um pouco antes de fechar para garantir que a UI atualizou
        setTimeout(() => {
          onClose();
        }, 1500);
        return;
      }
      
      // Se tem QR code
      if (response.Base64) {
        setQrCodeImage(response.Base64);
        setLoading(false);
        setError(null);
        setRetryCount(0);
        setStatusMessage(response.Message || 'Escaneie o QR Code com seu WhatsApp');
        return;
      }
      
      // Se não tem QR code ainda, não deve acontecer porque getQRCode já faz retry interno
      throw new Error('QR Code não foi gerado. Tente novamente.');
    } catch (err: any) {
      console.error('Erro ao obter QR Code:', err);
      setLoading(false);
      const errorMessage = err.message || 'Erro ao obter QR Code. Verifique se a instância existe.';
      setError(errorMessage);
      setStatusMessage('Erro ao conectar');
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const status = await instanceService.status(instanceId);
      const state = status.instance?.state || status.status || '';
      
      if (state === 'open' || state === 'connected') {
        setConnected(true);
        setStatusMessage('Conectado com sucesso!');
        clearTimers();
        toast.success('WhatsApp conectado com sucesso!');
        // Chama onConnected imediatamente para atualizar a lista
        onConnected?.();
        // Aguarda um pouco antes de fechar para garantir que a UI atualizou
        setTimeout(() => {
          onClose();
        }, 1500);
      } else if (state === 'close' || state === 'closed') {
        // Se desconectou, tenta obter novo QR code
        if (!loading && !error) {
          setStatusMessage('Conexão perdida. Gerando novo QR Code...');
          await fetchQRCode(true);
        }
      }
    } catch (err) {
      console.error('Erro ao verificar status:', err);
    }
  };

  const handleRetry = () => {
    setRetryCount(0);
    setError(null);
    fetchQRCode();
  };

  useEffect(() => {
    if (!isOpen || !instanceId) {
      clearTimers();
      return;
    }

    // Reset state quando o modal abre
    setQrCodeImage(null);
    setConnected(false);
    setError(null);
    setRetryCount(0);
    setLoading(true);
    setStatusMessage('Iniciando conexão...');

    // Timeout geral de conexão
    timeoutRef.current = setTimeout(() => {
      if (!connected) {
        setError('Tempo limite excedido. Tente novamente.');
        setLoading(false);
        clearTimers();
      }
    }, CONNECTION_TIMEOUT);

    // Busca inicial do QR code
    fetchQRCode();

    // Polling para atualizar QR code (se ainda não conectado e já tem QR code)
    intervalRef.current = setInterval(async () => {
      if (!connected && !loading && !error && qrCodeImage) {
        // Atualiza o QR code periodicamente (ele expira em ~20 segundos)
        await fetchQRCode(true);
      }
    }, QR_REFRESH_INTERVAL);

    // Polling para verificar status de conexão
    const statusInterval = setInterval(() => {
      if (!connected) {
        checkConnectionStatus();
      }
    }, STATUS_CHECK_INTERVAL);

    return () => {
      clearTimers();
      clearInterval(statusInterval);
      if (qrCodeImage && qrCodeImage.startsWith('blob:')) {
        URL.revokeObjectURL(qrCodeImage);
      }
    };
  }, [isOpen, instanceId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Conectar WhatsApp" size="sm">
      <div className="flex flex-col items-center space-y-4 py-4">
        {/* Loading State */}
        {loading && !error && (
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="animate-spin text-primary-500 dark:text-primary-400" size={48} />
            <p className="text-gray-700 dark:text-gray-300 font-medium">{statusMessage}</p>
            {retryCount > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Tentativa {retryCount} de {MAX_RETRIES}
              </p>
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center space-y-4 w-full">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 w-full">
              <div className="flex items-start space-x-3">
                <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
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
        {qrCodeImage && !loading && !connected && !error && (
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
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{statusMessage}</p>
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
                O QR Code expira em aproximadamente 20 segundos
              </p>
            </div>
          </>
        )}
        
        {/* Connected State */}
        {connected && (
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
