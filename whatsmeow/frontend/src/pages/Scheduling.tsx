import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Loader2, MessageCircle, Image, Music, FileText } from 'lucide-react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { instanceService, uploadService, scheduledMessageService, type ScheduledMessageItem } from '../services/api';
import { toast } from 'react-hot-toast';

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  image: 'Imagem',
  audio: 'Áudio',
  document: 'Documento',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Agendado',
  sent: 'Enviado',
  cancelled: 'Cancelado',
  failed: 'Falhou',
};

export function Scheduling() {
  const [items, setItems] = useState<ScheduledMessageItem[]>([]);
  const [instances, setInstances] = useState<{ id: string; instanceName?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [instanceId, setInstanceId] = useState('');
  const [number, setNumber] = useState('');
  const [messageType, setMessageType] = useState<'text' | 'image' | 'audio' | 'document'>('text');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [cancelTarget, setCancelTarget] = useState<ScheduledMessageItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const fetchInstances = async () => {
    try {
      const data = await instanceService.list();
      const list = Array.isArray(data) ? data : [];
      setInstances(list.map((item: any) => ({
        id: item.instance?.id || item.instanceName || item.id || String(item),
        instanceName: item.instanceName || item.instance?.id || item.id,
      })));
      if (list.length > 0 && !instanceId) {
        const first = list[0];
        setInstanceId(first.instance?.id || first.instanceName || first.id || first);
      }
    } catch {
      setInstances([]);
    }
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const list = await scheduledMessageService.list();
      setItems(list);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao carregar agendamentos');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  useEffect(() => {
    fetchList();
  }, []);

  const buildScheduledAt = (): string => {
    const date = scheduledDate.trim();
    const time = scheduledTime.trim();
    if (!date || !time) return '';
    const d = new Date(`${date}T${time}:00`);
    return d.toISOString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = number.trim().replace(/\D/g, '');
    if (num.length < 10) {
      toast.error('Número inválido. Use DDD + número (ex: 5511999999999).');
      return;
    }
    if (messageType === 'text' && !content.trim()) {
      toast.error('Digite o texto da mensagem.');
      return;
    }
    if (messageType !== 'text' && !mediaUrl.trim()) {
      toast.error('Envie um arquivo ou informe a URL da mídia.');
      return;
    }
    const at = buildScheduledAt();
    if (!at || new Date(at) <= new Date()) {
      toast.error('Data e hora devem ser futuras.');
      return;
    }
    setSaving(true);
    try {
      await scheduledMessageService.create({
        instance_id: instanceId,
        number: num,
        message_type: messageType,
        content: content.trim() || undefined,
        media_url: mediaUrl.trim() || undefined,
        scheduled_at: at,
      });
      toast.success('Mensagem agendada.');
      setShowModal(false);
      setNumber('');
      setContent('');
      setMediaUrl('');
      setUploadedFileName(null);
      setScheduledDate('');
      setScheduledTime('');
      fetchList();
    } catch (e: any) {
      const status = e.response?.status;
      const msg = e.response?.data?.message ?? e.message;
      if (status === 404) {
        toast.error('Rota de agendamento não encontrada (404). Verifique se a API está em /v1 e o backend está rodando.');
      } else {
        toast.error(typeof msg === 'string' ? msg : 'Erro ao agendar.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (item: ScheduledMessageItem) => {
    try {
      await scheduledMessageService.cancel(item.id);
      toast.success('Agendamento cancelado.');
      setCancelTarget(null);
      fetchList();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao cancelar');
    }
  };

  const openModal = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    setScheduledDate(`${y}-${m}-${d}`);
    setScheduledTime(`${h}:${min}`);
    setShowModal(true);
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image size={16} className="text-gray-500" />;
      case 'audio': return <Music size={16} className="text-gray-500" />;
      case 'document': return <FileText size={16} className="text-gray-500" />;
      default: return <MessageCircle size={16} className="text-gray-500" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agendamentos</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Agende mensagens de texto, imagem, áudio ou documento para data e hora definidas.
          </p>
        </div>
        <Button onClick={openModal} className="inline-flex items-center gap-2">
          <Plus size={18} />
          Agendar mensagem
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary-600" size={32} />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
          <Calendar className="mx-auto text-gray-400 dark:text-gray-500 mb-3" size={48} />
          <p className="text-gray-600 dark:text-gray-400">Nenhum agendamento ainda.</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Clique em &quot;Agendar mensagem&quot; para criar um.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Instância</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contato</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Preview</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data/hora</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-20">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.instance_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{item.remote_jid}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                        {typeIcon(item.message_type)}
                        {MESSAGE_TYPE_LABELS[item.message_type] || item.message_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-[200px] truncate">
                      {item.message_type === 'text' ? (item.content || '—') : (item.content || item.media_url || '[Mídia]')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(item.scheduled_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                        item.status === 'sent' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        item.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                      {item.status === 'failed' && item.error_msg && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 truncate max-w-[180px]" title={item.error_msg}>{item.error_msg}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => setCancelTarget(item)}
                          className="p-1.5 rounded text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          title="Cancelar agendamento"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Agendar mensagem"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instância</label>
            <select
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">Selecione</option>
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.instanceName || inst.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número (DDD + número)</label>
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="5511999999999"
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de mensagem</label>
            <select
              value={messageType}
              onChange={(e) => setMessageType(e.target.value as 'text' | 'image' | 'audio' | 'document')}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="text">Texto</option>
              <option value="image">Imagem</option>
              <option value="audio">Áudio</option>
              <option value="document">Documento</option>
            </select>
          </div>
          {messageType === 'text' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensagem</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Digite o texto..."
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Enviar arquivo (imagem, áudio ou documento)
                </label>
                <input
                  type="file"
                  accept={messageType === 'image' ? 'image/*' : messageType === 'audio' ? 'audio/*,.mp3,.m4a,.ogg,.wav,.aac' : '.pdf,.doc,.docx,.xls,.xlsx,application/pdf,image/*'}
                  className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-100 file:text-primary-700 dark:file:bg-primary-900/40 dark:file:text-primary-300"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    setUploadedFileName(null);
                    try {
                      const { url } = await uploadService.uploadFile(file);
                      setMediaUrl(url);
                      setUploadedFileName(file.name);
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || 'Erro ao enviar arquivo.');
                    } finally {
                      setUploading(false);
                      e.target.value = '';
                    }
                  }}
                  disabled={uploading}
                />
                {uploading && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Loader2 className="animate-spin" size={14} /> Enviando...</p>}
                {uploadedFileName && <p className="text-xs text-green-600 dark:text-green-400 mt-1">Arquivo: {uploadedFileName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ou URL da mídia</label>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => { setMediaUrl(e.target.value); setUploadedFileName(null); }}
                  placeholder="https://... (opcional se já enviou arquivo)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Legenda (opcional)</label>
                <input
                  type="text"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Legenda da mídia"
                />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data (horário local)</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hora (horário local)</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" size={18} /> : 'Agendar'}
            </Button>
          </div>
        </form>
      </Modal>

      {cancelTarget && (
        <Modal
          isOpen={!!cancelTarget}
          onClose={() => setCancelTarget(null)}
          title="Cancelar agendamento?"
        >
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            A mensagem agendada para {cancelTarget && new Date(cancelTarget.scheduled_at).toLocaleString('pt-BR')} será cancelada e não será enviada.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>Voltar</Button>
            <Button variant="danger" onClick={() => { if (cancelTarget) handleCancel(cancelTarget); }}>Cancelar agendamento</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
