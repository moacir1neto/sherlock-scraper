import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Loader2, Music, Video, FileText, Image as ImageIcon, Download, Reply, Heart, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { chatService } from '../../services/api';
import { MessageItem as MessageType } from '../../types';

interface MessageMediaProps {
  msg: MessageType;
  instanceId: string;
  chatId: string;
}

const EMOJI_LIST = ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😗','😋','😛','😜','🤪','😝','👍','👎','👏','🙌','👋','🤝','🙏','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','🔥','⭐','✨','💫','✅','❌','❗','❓','💬','📩','📱','📞','🎉','🎊','🎈','🏆','⭐','🌟'];

export function MessageMedia({ msg, instanceId, chatId }: MessageMediaProps) {
  const type = (msg.message_type || '').toLowerCase();
  const rawUrl = msg.media_url?.trim() ?? '';
  const caption = msg.content?.trim();
  const isLocal = typeof rawUrl === 'string' && rawUrl.toLowerCase().startsWith('local:');
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const loadMedia = useCallback(() => {
    if (!isLocal || !instanceId || !chatId || !msg.id) return;
    setError(false);
    setLoading(true);
    chatService.getMessageMedia(instanceId, chatId, msg.id)
      .then((blob: Blob | null) => {
        if (!blob) { setError(true); return; }
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = URL.createObjectURL(blob);
        setResolvedUrl(objectUrlRef.current);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isLocal, instanceId, chatId, msg.id]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const url = isLocal ? resolvedUrl : rawUrl;
  const hasUrl = !!url;

  if (isLocal && !resolvedUrl) {
    const PlaceholderIcon = type === 'audiomessage' ? Music : type === 'videomessage' ? Video : type === 'documentmessage' ? FileText : ImageIcon;
    return (
      <button onClick={loadMedia} className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-xs font-medium text-gray-500">
        {loading ? <Loader2 className="animate-spin" size={16} /> : <PlaceholderIcon size={16} />}
        <span>{error ? 'Falha. Tentar novamente' : 'Clique para carregar mídia'}</span>
      </button>
    );
  }

  if (type === 'imagemessage' && hasUrl) {
    return (
      <div className="space-y-1.5">
        <div className="relative group rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 shadow-sm border border-gray-200/50">
          <img src={url} alt="" className="max-w-[260px] h-auto max-h-80 object-cover" />
          <a href={url} download className="absolute bottom-2 right-2 p-2 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <Download size={16} />
          </a>
        </div>
        {caption && <p className="text-sm whitespace-pre-wrap leading-relaxed">{caption}</p>}
      </div>
    );
  }

  if (type === 'audiomessage' && hasUrl) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 p-2 bg-black/5 dark:bg-white/5 rounded-xl">
          <Music size={18} className="text-primary-500" />
          <audio controls className="h-8 w-48" src={url} />
        </div>
        {caption && <p className="text-sm">{caption}</p>}
      </div>
    );
  }

  if (type === 'videomessage' && hasUrl) {
    return (
      <div className="space-y-1.5">
        <video controls className="rounded-xl max-w-[260px] max-h-64 border border-gray-200/50" src={url} />
        {caption && <p className="text-sm">{caption}</p>}
      </div>
    );
  }

  if (type === 'documentmessage' && hasUrl) {
    return (
      <div className="space-y-1.5">
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-500 transition-all group">
          <FileText size={18} className="text-gray-400 group-hover:text-primary-500" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{caption || 'Documento'}</span>
        </a>
      </div>
    );
  }

  return null;
}

interface MessageItemProps {
  msg: MessageType;
  instanceId: string;
  chatId: string;
  onReply: (msg: MessageType) => void;
  reactionEmoji?: string;
  onReact: (msg: MessageType, emoji: string) => void;
  onRevoke?: (msg: MessageType) => void;
  onEdit?: (msg: MessageType) => void;
}

export const MessageItem = memo(function MessageItem({
  msg,
  instanceId,
  chatId,
  onReply,
  reactionEmoji,
  onReact,
  onRevoke,
  onEdit,
}: MessageItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [reactPickerOpen, setReactPickerOpen] = useState(false);
  const isMediaType = (t: string) => ['imagemessage', 'audiomessage', 'videomessage', 'documentmessage'].includes(t.toLowerCase());
  const isMedia = isMediaType(msg.message_type || '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'} mb-3 group`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setReactPickerOpen(false); }}
    >
      <div className={`relative ${msg.from_me ? 'max-w-[75%] ml-auto' : 'max-w-[75%]'}`}>
        <div className={`px-4 py-3 rounded-2xl shadow-sm ${
          msg.from_me 
            ? 'bg-emerald-600 text-white rounded-br-md shadow-emerald-600/10' 
            : 'bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-md shadow-gray-200/20 dark:shadow-none'
        }`}>
          {msg.quoted_preview && (
            <div className={`mb-2 p-2 border-l-4 rounded-r-lg text-[10px] font-bold uppercase tracking-wider opacity-60 truncate ${msg.from_me ? 'border-white/50 bg-white/10' : 'border-emerald-500 bg-emerald-50 dark:bg-gray-900/50'}`}>
              {msg.quoted_preview}
            </div>
          )}
          
          {msg.content && !isMedia && (
            <p className="text-sm whitespace-pre-wrap leading-relaxed break-words font-medium">
              {msg.content}
            </p>
          )}

          <MessageMedia msg={msg} instanceId={instanceId} chatId={chatId} />

          <div className={`flex items-center justify-end gap-2 mt-1.5 ${msg.from_me ? 'text-white/60' : 'text-gray-400'}`}>
            {reactionEmoji && (
              <span className="text-xs bg-white/20 backdrop-blur-sm border border-white/20 rounded-full px-1.5 py-0.5 shadow-sm">
                {reactionEmoji}
              </span>
            )}
            <span className="text-[10px] font-black uppercase tracking-tighter">
              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {msg.from_me && <span className="text-[10px] font-black uppercase tracking-tighter">· {msg.status}</span>}
          </div>
        </div>

        {/* Floating Actions */}
        <div className={`absolute top-0 ${msg.from_me ? '-left-10' : '-right-10'} flex flex-col gap-1 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}>
          <button onClick={() => onReply(msg)} className="p-1.5 rounded-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-primary-500 shadow-sm transition-all">
            <Reply size={14} />
          </button>
          <div className="relative">
            <button onClick={() => setReactPickerOpen(!reactPickerOpen)} className="p-1.5 rounded-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-rose-500 shadow-sm transition-all">
              <Heart size={14} />
            </button>
            {reactPickerOpen && (
              <div className={`absolute bottom-full mb-2 ${msg.from_me ? 'left-0' : 'right-0'} z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 w-64`}>
                <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                  {EMOJI_LIST.map((e) => (
                    <button key={e} onClick={() => { onReact(msg, e); setReactPickerOpen(false); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-lg transition-all hover:scale-110">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {msg.from_me && onEdit && !isMedia && (
            <button onClick={() => onEdit(msg)} className="p-1.5 rounded-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-primary-500 shadow-sm transition-all">
              <Pencil size={14} />
            </button>
          )}
          {msg.from_me && onRevoke && (
            <button onClick={() => onRevoke(msg)} className="p-1.5 rounded-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-rose-500 shadow-sm transition-all">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});
