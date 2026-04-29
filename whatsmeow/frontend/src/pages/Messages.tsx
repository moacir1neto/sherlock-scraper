import { useState } from 'react';
import { ArrowLeft, Send, Image, FileText, Mic, Users, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useNavigate, useParams } from 'react-router-dom';
import { messageService, chatService } from '../services/api';
import { validateWhatsAppNumber, validateURL } from '../utils/validators';
import { toast } from 'react-hot-toast';

type TabType = 'text' | 'image' | 'audio' | 'document' | 'chat' | 'numbers';

export function Messages() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('text');
  
  // Text message
  const [textNumber, setTextNumber] = useState('554196283086');
  const [textMessage, setTextMessage] = useState('');
  const [textLoading, setTextLoading] = useState(false);
  
  // Image message
  const [imageNumber, setImageNumber] = useState('554196283086');
  const [imageUrl, setImageUrl] = useState('https://picsum.photos/800/600');
  const [imageCaption, setImageCaption] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  
  // Audio message
  const [audioNumber, setAudioNumber] = useState('554196283086');
  const [audioUrl, setAudioUrl] = useState('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
  const [audioLoading, setAudioLoading] = useState(false);
  
  // Document message
  const [docNumber, setDocNumber] = useState('554196283086');
  const [docUrl, setDocUrl] = useState('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');
  const [docFileName, setDocFileName] = useState('teste.pdf');
  const [docLoading, setDocLoading] = useState(false);
  
  // Chat functions
  const [presenceNumber, setPresenceNumber] = useState('');
  const [presenceLoading, setPresenceLoading] = useState(false);
  const [readNumber, setReadNumber] = useState('');
  const [readMessageId, setReadMessageId] = useState('');
  const [readLoading, setReadLoading] = useState(false);
  
  // Check numbers
  const [checkNumbers, setCheckNumbers] = useState('');
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checkLoading, setCheckLoading] = useState(false);

  if (!instanceId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Instância não encontrada</p>
          <Button onClick={() => navigate('/instances')}>Voltar</Button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'text' as TabType, label: 'Texto', icon: Send },
    { id: 'image' as TabType, label: 'Imagem', icon: Image },
    { id: 'audio' as TabType, label: 'Áudio', icon: Mic },
    { id: 'document' as TabType, label: 'Documento', icon: FileText },
    { id: 'chat' as TabType, label: 'Chat', icon: Eye },
    { id: 'numbers' as TabType, label: 'Verificar Números', icon: Users },
  ];

  const handleSendText = async () => {
    if (!textNumber.trim() || !textMessage.trim()) {
      toast.error('Preencha o número e a mensagem');
      return;
    }

    try {
      setTextLoading(true);
      await messageService.sendText(instanceId, textNumber, textMessage);
      toast.success('Mensagem de texto enviada com sucesso!');
      setTextMessage('');
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.message || 'Erro ao enviar mensagem';
      toast.error(errorMessage);
    } finally {
      setTextLoading(false);
    }
  };

  const handleSendImage = async () => {
    if (!imageNumber.trim() || !imageUrl.trim()) {
      toast.error('Preencha o número e a URL da imagem');
      return;
    }

    // Validação básica de URL
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      toast.error('URL inválida. Use http:// ou https://');
      return;
    }

    try {
      setImageLoading(true);
      await messageService.sendImage(instanceId, imageNumber, imageUrl, imageCaption || undefined);
      toast.success('Imagem enviada com sucesso!');
      setImageUrl('');
      setImageCaption('');
    } catch (error: any) {
      console.error('Erro ao enviar imagem:', error);
      const errorMessage = error.message || error.response?.data?.message || 'Erro ao enviar imagem';
      toast.error(errorMessage);
    } finally {
      setImageLoading(false);
    }
  };

  const handleSendAudio = async () => {
    const trimmedNumber = audioNumber.trim();
    const trimmedUrl = audioUrl.trim();
    
    console.log('handleSendAudio - Valores:', {
      instanceId,
      audioNumber,
      audioUrl,
      trimmedNumber,
      trimmedUrl,
    });
    
    if (!trimmedNumber || !trimmedUrl) {
      toast.error('Preencha o número e a URL do áudio');
      return;
    }

    // Validação básica de URL
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      toast.error('URL inválida. Use http:// ou https://');
      return;
    }

    try {
      setAudioLoading(true);
      console.log('Chamando messageService.sendAudio com:', {
        instanceId,
        number: trimmedNumber,
        audio: trimmedUrl,
      });
      await messageService.sendAudio(instanceId, trimmedNumber, trimmedUrl);
      toast.success('Áudio enviado com sucesso!');
      // Não limpar os campos para facilitar novos testes
    } catch (error: any) {
      console.error('Erro ao enviar áudio:', error);
      console.error('Detalhes do erro:', {
        message: error.message,
        response: error.response?.data,
        requestData: error.config?.data,
        status: error.response?.status,
      });
      const errorMessage = error.message || error.response?.data?.message || 'Erro ao enviar áudio';
      toast.error(errorMessage);
    } finally {
      setAudioLoading(false);
    }
  };

  const handleSendDocument = async () => {
    if (!docNumber.trim() || !docUrl.trim() || !docFileName.trim()) {
      toast.error('Preencha o número, URL e nome do arquivo');
      return;
    }

    // Validação básica de URL
    if (!docUrl.startsWith('http://') && !docUrl.startsWith('https://')) {
      toast.error('URL inválida. Use http:// ou https://');
      return;
    }

    try {
      setDocLoading(true);
      await messageService.sendDocument(instanceId, docNumber, docUrl, docFileName);
      toast.success('Documento enviado com sucesso!');
      setDocUrl('');
      setDocFileName('');
    } catch (error: any) {
      console.error('Erro ao enviar documento:', error);
      const errorMessage = error.message || error.response?.data?.message || 'Erro ao enviar documento';
      toast.error(errorMessage);
    } finally {
      setDocLoading(false);
    }
  };

  const handleSendPresence = async () => {
    if (!presenceNumber.trim()) {
      toast.error('Preencha o número');
      return;
    }

    try {
      setPresenceLoading(true);
      await chatService.sendPresence(instanceId, presenceNumber);
      toast.success('Presença enviada com sucesso!');
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.message || 'Erro ao enviar presença';
      toast.error(errorMessage);
    } finally {
      setPresenceLoading(false);
    }
  };

  const handleReadMessages = async () => {
    if (!readNumber.trim() || !readMessageId.trim()) {
      toast.error('Preencha o número e o ID da mensagem');
      return;
    }

    try {
      setReadLoading(true);
      await chatService.readMessages(instanceId, readNumber, readMessageId);
      toast.success('Mensagens marcadas como lidas!');
      setReadMessageId('');
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.message || 'Erro ao marcar como lida';
      toast.error(errorMessage);
    } finally {
      setReadLoading(false);
    }
  };

  const handleCheckNumbers = async () => {
    if (!checkNumbers.trim()) {
      toast.error('Digite pelo menos um número');
      return;
    }

    const numbersArray = checkNumbers.split(',').map(n => n.trim()).filter(n => n);
    if (numbersArray.length === 0) {
      toast.error('Números inválidos');
      return;
    }

    try {
      setCheckLoading(true);
      const result = await chatService.checkNumbers(instanceId, numbersArray);
      setCheckResult(result);
      toast.success('Verificação concluída!');
    } catch (error: any) {
      const errorMessage = error.message || error.response?.data?.message || 'Erro ao verificar números';
      toast.error(errorMessage);
    } finally {
      setCheckLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/instances')}
            >
              <ArrowLeft size={18} className="mr-2" />
              Voltar para Instâncias
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            API Playground - {instanceId}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Teste todas as funcionalidades da API</p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-6"
        >
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <motion.button
                    key={tab.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors
                      ${activeTab === tab.id
                        ? 'border-primary-500 dark:border-primary-400 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }
                    `}
                  >
                    <Icon size={18} className="mr-2" />
                    {tab.label}
                  </motion.button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Text Tab */}
            {activeTab === 'text' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Enviar Mensagem de Texto</h2>
                <Input
                  label="Número do WhatsApp"
                  placeholder="5511999999999"
                  value={textNumber}
                  onChange={(e) => setTextNumber(e.target.value)}
                  validateOnBlur
                  validator={validateWhatsAppNumber}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mensagem
                  </label>
                  <textarea
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    rows={4}
                    placeholder="Digite sua mensagem..."
                    value={textMessage}
                    onChange={(e) => setTextMessage(e.target.value)}
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={handleSendText}
                  disabled={textLoading || !textNumber.trim() || !textMessage.trim()}
                  loading={textLoading}
                  className="w-full"
                >
                  Enviar Mensagem
                </Button>
              </motion.div>
            )}

            {/* Image Tab */}
            {activeTab === 'image' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Enviar Imagem</h2>
                <Input
                  label="Número do WhatsApp"
                  placeholder="5511999999999"
                  value={imageNumber}
                  onChange={(e) => setImageNumber(e.target.value)}
                  validateOnBlur
                  validator={validateWhatsAppNumber}
                />
                <Input
                  label="URL da Imagem"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  type="url"
                  validateOnBlur
                  validator={validateURL}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  A URL deve ser acessível publicamente. Use http:// ou https://
                </p>
                <Input
                  label="Legenda (opcional)"
                  placeholder="Descrição da imagem"
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                />
                <Button
                  variant="primary"
                  onClick={handleSendImage}
                  disabled={imageLoading || !imageNumber.trim() || !imageUrl.trim()}
                  loading={imageLoading}
                  className="w-full"
                >
                  Enviar Imagem
                </Button>
              </motion.div>
            )}

            {/* Audio Tab */}
            {activeTab === 'audio' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Enviar Áudio</h2>
                <Input
                  label="Número do WhatsApp"
                  placeholder="5511999999999"
                  value={audioNumber}
                  onChange={(e) => setAudioNumber(e.target.value)}
                  validateOnBlur
                  validator={validateWhatsAppNumber}
                />
                <Input
                  label="URL do Áudio"
                  placeholder="https://example.com/audio.mp3"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  type="url"
                  validateOnBlur
                  validator={validateURL}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  A URL deve ser acessível publicamente. O áudio será convertido para formato OGG/Opus automaticamente.
                </p>
                <Button
                  variant="primary"
                  onClick={handleSendAudio}
                  disabled={audioLoading || !audioNumber.trim() || !audioUrl.trim()}
                  loading={audioLoading}
                  className="w-full"
                >
                  Enviar Áudio
                </Button>
              </motion.div>
            )}

            {/* Document Tab */}
            {activeTab === 'document' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Enviar Documento</h2>
                <Input
                  label="Número do WhatsApp"
                  placeholder="5511999999999"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  validateOnBlur
                  validator={validateWhatsAppNumber}
                />
                <Input
                  label="URL do Documento"
                  placeholder="https://example.com/document.pdf"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  type="url"
                  validateOnBlur
                  validator={validateURL}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  A URL deve ser acessível publicamente. Formatos suportados: PDF, DOC, DOCX, etc.
                </p>
                <Input
                  label="Nome do Arquivo"
                  placeholder="documento.pdf"
                  value={docFileName}
                  onChange={(e) => setDocFileName(e.target.value)}
                />
                <Button
                  variant="primary"
                  onClick={handleSendDocument}
                  disabled={docLoading || !docNumber.trim() || !docUrl.trim() || !docFileName.trim()}
                  loading={docLoading}
                  className="w-full"
                >
                  Enviar Documento
                </Button>
              </motion.div>
            )}

            {/* Chat Tab */}
            {activeTab === 'chat' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Funções de Chat</h2>
                
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Enviar Presença</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Indica que você está digitando</p>
                  <Input
                    label="Número do WhatsApp"
                    placeholder="5511999999999"
                    value={presenceNumber}
                    onChange={(e) => setPresenceNumber(e.target.value)}
                    validateOnBlur
                    validator={validateWhatsAppNumber}
                  />
                  <Button
                    variant="secondary"
                    onClick={handleSendPresence}
                    disabled={presenceLoading || !presenceNumber.trim()}
                    loading={presenceLoading}
                    className="w-full"
                  >
                    Enviar Presença
                  </Button>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Marcar como Lida</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Marca mensagens como lidas</p>
                  <Input
                    label="Número do WhatsApp"
                    placeholder="5511999999999"
                    value={readNumber}
                    onChange={(e) => setReadNumber(e.target.value)}
                    validateOnBlur
                    validator={validateWhatsAppNumber}
                  />
                  <Input
                    label="ID da Mensagem"
                    placeholder="3EB0..."
                    value={readMessageId}
                    onChange={(e) => setReadMessageId(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    onClick={handleReadMessages}
                    disabled={readLoading || !readNumber.trim() || !readMessageId.trim()}
                    loading={readLoading}
                    className="w-full"
                  >
                    Marcar como Lida
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Numbers Tab */}
            {activeTab === 'numbers' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Verificar Números WhatsApp</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Números (separados por vírgula)
                  </label>
                  <textarea
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    rows={4}
                    placeholder="5511999999999, 5521999999999, 5531999999999"
                    value={checkNumbers}
                    onChange={(e) => setCheckNumbers(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Separe múltiplos números por vírgula
                  </p>
                </div>
                <Button
                  variant="primary"
                  onClick={handleCheckNumbers}
                  disabled={checkLoading || !checkNumbers.trim()}
                  loading={checkLoading}
                  className="w-full"
                >
                  Verificar Números
                </Button>

                {checkResult && (
                  <div className="mt-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Resultado:</h3>
                    <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded text-sm overflow-auto text-gray-900 dark:text-gray-100">
                      {JSON.stringify(checkResult, null, 2)}
                    </pre>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
