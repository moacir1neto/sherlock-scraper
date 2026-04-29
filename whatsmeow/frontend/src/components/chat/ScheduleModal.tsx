import { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { scheduledMessageService, uploadService } from '../../services/api';
import { ChatItem } from '../../types';

interface ScheduleModalProps {
  chat: ChatItem;
  onClose: () => void;
}

export function ScheduleModal({ chat, onClose }: ScheduleModalProps) {
  const [type, setType] = useState<'text' | 'image' | 'audio' | 'document'>('text');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = (chat.remote_jid || '').replace(/@.*/, '').replace(/\D/g, '');
    if (num.length < 10) { toast.error('Número inválido.'); return; }
    if (type === 'text' && !content.trim()) { toast.error('Digite o texto.'); return; }
    if (type !== 'text' && !mediaUrl.trim()) { toast.error('Envie um arquivo.'); return; }
    if (!date || !time) { toast.error('Informe data e hora.'); return; }

    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
    if (new Date(scheduledAt) <= new Date()) {
      toast.error('Data deve ser no futuro.');
      return;
    }

    setSaving(true);
    try {
      await scheduledMessageService.create({
        instance_id: chat.instance_id,
        number: num,
        message_type: type,
        content: content.trim(),
        media_url: type !== 'text' ? mediaUrl.trim() : '',
        scheduled_at: scheduledAt,
      });
      toast.success('Agendada');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao agendar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-8 max-w-md w-full max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
              <Calendar size={20} />
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Agendar Mensagem</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Tipo de Mensagem</label>
            <div className="grid grid-cols-4 gap-2">
              {(['text', 'image', 'audio', 'document'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                    type === t 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {type === 'text' ? (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Mensagem</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="Digite o conteúdo..."
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Arquivo</label>
                <input
                  type="file"
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-emerald-100 file:text-emerald-700"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const { url } = await uploadService.uploadFile(file);
                      setMediaUrl(url);
                      setUploadedFile(file.name);
                    } catch { toast.error('Erro no upload'); } finally { setUploading(false); }
                  }}
                />
                {uploading && <p className="text-[10px] text-emerald-500 font-bold animate-pulse">Enviando arquivo...</p>}
                {uploadedFile && <p className="text-[10px] text-emerald-500 font-bold">{uploadedFile} pronto</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Legenda</label>
                <input
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Opcional..."
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Hora</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || uploading}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all disabled:opacity-50"
          >
            {saving ? 'Agendando...' : 'Confirmar Agendamento'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
