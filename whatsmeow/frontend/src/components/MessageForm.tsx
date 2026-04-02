import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { messageService } from '../services/api';
import { toast } from 'react-hot-toast';

interface MessageFormProps {
  instanceId: string;
  onSent?: () => void;
}

export function MessageForm({ instanceId, onSent }: MessageFormProps) {
  const [number, setNumber] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendText = async () => {
    const trimmedNumber = number.trim();
    const trimmedMessage = message.trim();
    
    if (!trimmedNumber || !trimmedMessage) {
      toast.error('Preencha o número e a mensagem');
      return;
    }

    // Validação básica do número
    const numberRegex = /^\+?[1-9]\d{10,14}$/;
    const cleanNumber = trimmedNumber.replace(/[^\d+]/g, '');
    
    if (!numberRegex.test(cleanNumber)) {
      toast.error('Número inválido. Use o formato: 5511999999999 (com código do país)');
      return;
    }

    try {
      setLoading(true);
      await messageService.sendText(instanceId, trimmedNumber, trimmedMessage);
      toast.success('Mensagem enviada com sucesso!');
      setMessage('');
      setNumber(''); // Limpa também o número
      onSent?.();
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      const errorMessage = error.message || error.response?.data?.message || 'Erro ao enviar mensagem';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Enviar Mensagem</h3>
      
      <div className="space-y-4">
        <Input
          label="Número do WhatsApp"
          placeholder="5511999999999"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mensagem
          </label>
          <textarea
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            rows={4}
            placeholder="Digite sua mensagem..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <Button
          variant="primary"
          onClick={handleSendText}
          disabled={loading || !number.trim() || !message.trim()}
          className="w-full flex items-center justify-center"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Enviando...
            </>
          ) : (
            <>
              <Send size={18} className="mr-2" />
              Enviar Mensagem
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

