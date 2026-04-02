import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Send, Loader2, Smile, FileText, Image as ImageIcon, Music, Video, Download, Reply, Heart, Trash2, Pencil, Tag as TagIcon, X, Calendar } from 'lucide-react';
import { instanceService, chatService, messageService, tagService, sectorService, quickRepliesService, flowService, uploadService, scheduledMessageService } from '../services/api';
import { toast } from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { getNotificationSettings } from '../utils/notificationSettings';

export interface ChatItem {
  id: string;
  instance_id: string;
  remote_jid: string;
  name: string;
  last_message_preview?: string;
  last_message_at?: string;
  created_at?: string;
  updated_at?: string;
  sector_id?: string | null;
  status?: 'aguardando' | 'atendendo' | 'finalizado' | string;
}

export interface MessageItem {
  id: string;
  chat_id: string;
  wa_message_id: string;
  from_me: boolean;
  message_type: string;
  content: string;
  media_url?: string;
  status: string;
  created_at: string;
  /** Preview da mensagem citada (resposta); quando presente, o balão é exibido como resposta */
  quoted_preview?: string;
  quoted_message_id?: string;
}

function parseJidToNumber(remoteJid: string): string {
  if (!remoteJid) return '';
  const parts = remoteJid.split('@');
  return parts[0] || remoteJid;
}

function getChatDisplayName(chat: ChatItem): string {
  const name = typeof chat.name === 'string' ? chat.name.trim() : '';
  if (name) return name;
  const num = parseJidToNumber(chat.remote_jid || '');
  if (num) return num;
  return chat.remote_jid || 'Contato';
}

function getAvatarLetter(chat: ChatItem): string {
  const name = getChatDisplayName(chat);
  return name.charAt(0).toUpperCase() || '?';
}

function sortChatsByLastMessage(chats: ChatItem[]): ChatItem[] {
  return [...chats].sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta; // mais recente primeiro
  });
}

function getMessageIdentity(msg: MessageItem): string {
  return msg.wa_message_id || msg.id;
}

function mergeMessages(prev: MessageItem[], incoming: MessageItem[]): MessageItem[] {
  if (!incoming.length) return prev;
  const byIdentity = new Map<string, MessageItem>();
  for (const item of prev) {
    byIdentity.set(getMessageIdentity(item), item);
  }
  for (const item of incoming) {
    const id = getMessageIdentity(item);
    const existing = byIdentity.get(id);
    byIdentity.set(id, existing ? { ...existing, ...item } : item);
  }
  return Array.from(byIdentity.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

function mergeMessagesForChat(chatId: string, prev: MessageItem[], incoming: MessageItem[]): MessageItem[] {
  const prevSameChat = prev.filter((m) => m.chat_id === chatId);
  const incomingSameChat = incoming.filter((m) => m.chat_id === chatId);
  return mergeMessages(prevSameChat, incomingSameChat);
}

const MESSAGES_PAGE_SIZE = 30;

export type ChatMessagesCacheEntry = {
  messages: MessageItem[];
  hasMore: boolean;
};

const EMOJI_LIST = ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😗','😋','😛','😜','🤪','😝','👍','👎','👏','🙌','👋','🤝','🙏','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','🔥','⭐','✨','💫','✅','❌','❗','❓','💬','📩','📱','📞','🎉','🎊','🎈','🏆','⭐','🌟'];

const isMediaType = (t: string) =>
  t === 'imageMessage' || t === 'audioMessage' || t === 'videoMessage' || t === 'documentMessage';

function MessageMedia({ msg, instanceId, chatId }: { msg: MessageItem; instanceId: string; chatId: string }) {
  const type = (msg.message_type || '').toLowerCase();
  const rawUrl = msg.media_url?.trim() ?? '';
  const caption = msg.content?.trim();
  const isLocal = typeof rawUrl === 'string' && rawUrl.toLowerCase().startsWith('local:');
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const isFromMe = msg.from_me;

  const loadMedia = useCallback(() => {
    if (!isLocal || !instanceId || !chatId || !msg.id) return;
    setError(false);
    setLoading(true);
    chatService
      .getMessageMedia(instanceId, chatId, msg.id)
      .then((blob) => {
        if (!blob) {
          setError(true);
          return;
        }
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = URL.createObjectURL(blob);
        setResolvedUrl(objectUrlRef.current);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isLocal, instanceId, chatId, msg.id]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const url = isLocal ? resolvedUrl : rawUrl;
  const hasUrl = !!url;

  if (isLocal && !resolvedUrl) {
    if (loading) {
      return (
        <div className="flex items-center gap-2 py-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="animate-spin" size={18} />
          <span>Carregando mídia...</span>
        </div>
      );
    }
    const PlaceholderIcon = type === 'audiomessage' ? Music : type === 'videomessage' ? Video : type === 'documentmessage' ? FileText : ImageIcon;
    if (error) {
      return (
        <button
          type="button"
          onClick={loadMedia}
          className="flex items-center gap-2 py-2 text-sm text-amber-600 dark:text-amber-400 hover:underline"
        >
          <PlaceholderIcon size={18} />
          <span>Falha ao carregar. Clique para tentar novamente.</span>
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={loadMedia}
        className="flex items-center gap-2 py-2 px-3 rounded-lg border border-dashed border-gray-400 dark:border-gray-500 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 text-sm"
      >
        <PlaceholderIcon size={18} />
        <span>Clique para carregar mídia</span>
      </button>
    );
  }

  if (type === 'imagemessage' && hasUrl) {
    return (
      <div className="space-y-1">
        <div className="relative group rounded-xl overflow-hidden max-w-[260px] bg-black/5 dark:bg-black/20">
          <a href={url} target="_blank" rel="noopener noreferrer" className="block focus:ring-2 focus:ring-primary-400 focus:outline-none rounded-xl">
            <img src={url} alt="" className="w-full h-auto max-h-80 object-cover" loading="lazy" />
          </a>
          <a
            href={url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Baixar imagem"
          >
            <Download size={18} />
          </a>
        </div>
        {caption && <p className="text-sm whitespace-pre-wrap break-words">{caption}</p>}
      </div>
    );
  }

  if (type === 'audiomessage') {
    if (hasUrl) {
      return (
        <div className="space-y-1">
          <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 max-w-[260px] ${isFromMe ? 'bg-white/20' : 'bg-black/10 dark:bg-white/10'}`}>
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isFromMe ? 'bg-white/30' : 'bg-primary-500/30 dark:bg-primary-400/30'}`}>
              <Music size={22} className={isFromMe ? 'text-white' : 'text-primary-600 dark:text-primary-400'} />
            </div>
            <audio
              controls
              className="flex-1 h-10 min-w-0 [&::-webkit-media-controls-panel]:bg-transparent"
              src={url}
              preload="metadata"
            />
          </div>
          {caption && <p className="text-sm whitespace-pre-wrap break-words">{caption}</p>}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 py-1 text-sm opacity-90">
        <Music size={18} />
        <span>Áudio não disponível</span>
      </div>
    );
  }

  if (type === 'videomessage') {
    if (hasUrl) {
      return (
        <div className="space-y-1">
          <video controls className="rounded-xl max-w-[260px] max-h-64 w-full" src={url} preload="metadata" playsInline />
          {caption && <p className="text-sm whitespace-pre-wrap break-words">{caption}</p>}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 py-1 text-sm opacity-90">
        <Video size={18} />
        <span>Vídeo não disponível</span>
      </div>
    );
  }

  if (type === 'documentmessage') {
    if (hasUrl) {
      return (
        <div className="space-y-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
          >
            <FileText size={20} />
            <span className="text-sm font-medium">{caption || 'Documento'}</span>
          </a>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 py-1 text-sm opacity-90">
        <FileText size={18} />
        <span>Documento não disponível</span>
      </div>
    );
  }

  if (hasUrl) {
    return (
      <div className="space-y-1">
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm underline opacity-90">
          Abrir mídia
        </a>
        {caption && <p className="text-sm whitespace-pre-wrap break-words">{caption}</p>}
      </div>
    );
  }

  if (isMediaType(type)) {
    const Icon = type === 'imageMessage' ? ImageIcon : type === 'audioMessage' ? Music : type === 'videoMessage' ? Video : FileText;
    return (
      <div className="flex items-center gap-2 py-1 text-sm opacity-80">
        <Icon size={18} />
        <span>Mídia não disponível (configure armazenamento no servidor)</span>
      </div>
    );
  }

  return null;
}

const MessageBubble = React.memo(function MessageBubble({
  msg,
  instanceId,
  chatId,
  remoteJid: _remoteJid,
  onReply,
  reactionEmoji,
  onReact,
  onRevoke,
  onEdit,
}: {
  msg: MessageItem;
  instanceId: string;
  chatId: string;
  remoteJid: string;
  onReply: (msg: MessageItem) => void;
  reactionEmoji?: string;
  onReact: (msg: MessageItem, emoji: string) => void;
  onRevoke?: (msg: MessageItem) => void;
  onEdit?: (msg: MessageItem) => void;
}) {
  const isMedia = isMediaType((msg.message_type || '').toLowerCase());
  const showText = msg.content && !isMedia;
  const [showActions, setShowActions] = useState(false);
  const [reactPickerOpen, setReactPickerOpen] = useState(false);

  return (
    <div
      className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'} gap-1 group/bubble`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setReactPickerOpen(false); }}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm relative ${
          msg.from_me
            ? 'rounded-br-md bg-primary-600 text-white dark:bg-primary-500'
            : 'rounded-bl-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600'
        } ${msg.quoted_preview ? 'border-l-4 border-l-primary-400 dark:border-l-primary-400' : ''}`}
      >
        {msg.quoted_preview && (
          <div className={`mb-2 pl-2 border-l-2 rounded ${
            msg.from_me
              ? 'border-white/50 text-primary-100 dark:text-primary-200'
              : 'border-gray-400 dark:border-gray-500 text-gray-600 dark:text-gray-400'
          }`}>
            <p className="text-xs font-medium">Respondendo a:</p>
            <p className="text-xs truncate max-w-[200px]" title={msg.quoted_preview}>{msg.quoted_preview}</p>
          </div>
        )}
        {showText && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
        <MessageMedia msg={msg} instanceId={instanceId} chatId={chatId} />
        {/* Linha: reação + hora + ações (responder/reagir) */}
        <div className="flex items-center justify-end gap-1.5 mt-1 flex-wrap">
          {reactionEmoji && (
            <span className="text-sm" title="Reação">{reactionEmoji}</span>
          )}
          <p className={`text-[10px] flex items-center gap-1 ${msg.from_me ? 'text-primary-100 dark:text-primary-200' : 'text-gray-500 dark:text-gray-400'}`}>
            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {msg.from_me && msg.status && <span>· {msg.status}</span>}
          </p>
          {(showActions || reactPickerOpen) && (
            <span className="flex items-center gap-0.5 ml-1">
              <button
                type="button"
                onClick={() => onReply(msg)}
                className={`p-1.5 rounded transition-colors ${
                  msg.from_me
                    ? 'text-white/90 hover:bg-white/20'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10'
                }`}
                title="Responder"
              >
                <Reply size={14} />
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setReactPickerOpen(true)}
                  className={`p-1.5 rounded transition-colors ${
                    msg.from_me
                      ? 'text-white/90 hover:bg-white/20'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                  title="Reagir"
                >
                  <Heart size={14} />
                </button>
                {reactPickerOpen && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Escolher reação"
                    onClick={() => setReactPickerOpen(false)}
                  >
                    <div
                      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-600 p-4 max-w-sm w-full"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Reagir</h3>
                      <div className="grid grid-cols-8 gap-1.5 max-h-[240px] overflow-y-auto">
                        {EMOJI_LIST.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-xl transition-colors"
                            onClick={() => {
                              onReact(msg, emoji);
                              setReactPickerOpen(false);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {msg.from_me && (
                <>
                  {showText && onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(msg)}
                      className={`p-1.5 rounded transition-colors ${
                        msg.from_me ? 'text-white/90 hover:bg-white/20' : 'text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10'
                      }`}
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  {onRevoke && (
                    <button
                      type="button"
                      onClick={() => onRevoke(msg)}
                      className="p-1.5 rounded text-white/90 hover:bg-white/20 transition-colors"
                      title="Apagar para todos"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

function ChatAvatar({
  instanceId,
  remoteJid,
  displayLetter,
  size = 'md',
}: {
  instanceId: string;
  remoteJid: string;
  displayLetter: string;
  size?: 'sm' | 'md';
}) {
  const [src, setSrc] = useState<string | null>(null);
  const sizeClass = size === 'sm' ? 'w-10 h-10 text-base' : 'w-12 h-12 text-lg';

  useEffect(() => {
    if (!instanceId || !remoteJid) return;
    let objectUrl: string | null = null;
    chatService.getProfilePicture(instanceId, remoteJid).then((blob) => {
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      }
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [instanceId, remoteJid]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`flex-shrink-0 rounded-full bg-primary-100 dark:bg-primary-900/40 object-cover ${sizeClass}`}
      />
    );
  }
  return (
    <div
      className={`flex-shrink-0 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center font-semibold overflow-hidden ${sizeClass}`}
    >
      {displayLetter}
    </div>
  );
}

export function Chat() {
  const { theme } = useTheme();
  useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [instances, setInstances] = useState<{ id: string; instanceName?: string }[]>([]);
  const [instanceId, setInstanceId] = useState<string>('');
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [messagesByChatId, setMessagesByChatId] = useState<Record<string, ChatMessagesCacheEntry>>({});
  const [inputText, setInputText] = useState('');
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [_ws, setWs] = useState<WebSocket | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<MessageItem | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [revokeTarget, setRevokeTarget] = useState<MessageItem | null>(null);
  const [editTarget, setEditTarget] = useState<MessageItem | null>(null);
  const [editText, setEditText] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [chatTags, setChatTags] = useState<Array<{ id: string; name: string; color?: string }>>([]);
  const [allTags, setAllTags] = useState<Array<{ id: string; name: string; color?: string }>>([]);
  const [activeQueue, setActiveQueue] = useState<'aguardando' | 'atendendo' | 'finalizado'>('aguardando');
  const [sectors, setSectors] = useState<Array<{ id: string; name: string; is_default?: boolean }>>([]);
  const [changingStatus, setChangingStatus] = useState(false);
  const [changingSector, setChangingSector] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleType, setScheduleType] = useState<'text' | 'image' | 'audio' | 'document'>('text');
  const [scheduleContent, setScheduleContent] = useState('');
  const [scheduleMediaUrl, setScheduleMediaUrl] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleUploading, setScheduleUploading] = useState(false);
  const [scheduleUploadedFile, setScheduleUploadedFile] = useState<string | null>(null);
  const [chatTagSummary, setChatTagSummary] = useState<Record<string, Array<{ id: string; name: string; color?: string }>>>({});
  const [activeTagFilterId, setActiveTagFilterId] = useState<string | null>(null);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [activeSectorFilterId, setActiveSectorFilterId] = useState<string | null>(null);
  const [quickRepliesList, setQuickRepliesList] = useState<Array<{ id: string; command: string; message: string }>>([]);
  const [quickReplyHighlightIndex, setQuickReplyHighlightIndex] = useState(0);
  const [flowsList, setFlowsList] = useState<Array<{ id: string; command?: string; name: string }>>([]);
  const [flowHighlightIndex, setFlowHighlightIndex] = useState(0);
  const selectedChatRef = useRef<ChatItem | null>(null);
  const instanceIdRef = useRef<string>('');
  const chatsRef = useRef<ChatItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /** Após enviar, rolar para o fim da conversa na próxima atualização das mensagens */
  const scrollAfterSendRef = useRef(false);
  /** Ao abrir uma conversa, rolar para o final quando as mensagens carregarem */
  const scrollWhenOpeningRef = useRef(false);
  /** Após enviar uma resposta, guardamos o id da mensagem e o preview para mesclar no listado */
  const pendingQuotedRef = useRef<{ waMessageId: string; preview: string } | null>(null);
  const notifications = useNotifications();
  const addNotificationRef = useRef(notifications?.addNotification);
  addNotificationRef.current = notifications?.addNotification;
  /** Usado ao prepend de mensagens antigas para restaurar posição de scroll */
  const scrollRestoreRef = useRef<{ chatId: string; scrollHeight: number; scrollTop: number } | null>(null);

  const messages = useMemo(() => {
    if (!selectedChat) return [];
    const entry = messagesByChatId[selectedChat.id];
    return entry?.messages ?? [];
  }, [selectedChat, messagesByChatId]);

  const hasMoreOlder = useMemo(() => {
    if (!selectedChat) return false;
    const entry = messagesByChatId[selectedChat.id];
    return entry?.hasMore ?? false;
  }, [selectedChat, messagesByChatId]);

  const scrollToConversationBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const sentinel = messagesEndRef.current;
    const container = messagesContainerRef.current;
    if (sentinel) {
      sentinel.scrollIntoView({ behavior, block: 'end' });
      return;
    }
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior });
    }
  }, []);

  selectedChatRef.current = selectedChat;
  instanceIdRef.current = instanceId;
  chatsRef.current = chats;

  const wsUrl = useMemo(() => {
    if (!instanceId || typeof window === 'undefined') return '';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = localStorage.getItem('token');
    return `${proto}//${host}/v1/ws/chat?instance_id=${encodeURIComponent(instanceId)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
  }, [instanceId]);

  const reconnectDelayRef = useRef(1000);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!wsUrl) {
      setWs(null);
      return;
    }
    reconnectDelayRef.current = 1000;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      if (socketRef.current) {
        try {
          socketRef.current.onclose = () => {};
          socketRef.current.close();
        } catch (_) {}
        socketRef.current = null;
      }
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      const normalizeMessage = (raw: any): MessageItem => {
        const createdAt = raw?.created_at;
        return {
          id: raw?.id || raw?.wa_message_id || `ws-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          chat_id: raw?.chat_id ?? '',
          wa_message_id: raw?.wa_message_id ?? '',
          from_me: !!raw?.from_me,
          message_type: raw?.message_type ?? 'text',
          content: raw?.content ?? '',
          media_url: raw?.media_url,
          status: raw?.status ?? 'sent',
          created_at: typeof createdAt === 'string' ? createdAt : (createdAt ? new Date(createdAt).toISOString() : new Date().toISOString()),
        };
      };

      socket.onopen = () => {
        setWsConnected(true);
        reconnectDelayRef.current = 1000;
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const { type, data } = payload;
          if (type === 'new_message' && data) {
            const currentChatId = selectedChatRef.current?.id;
            const isIncoming = data.message && !data.message.from_me;
            const isCurrentChat = data.chat_id === currentChatId;
            if (data.chat_id === currentChatId && data.message) {
              const normalized = normalizeMessage(data.message);
              if (pendingQuotedRef.current && normalized.from_me && normalized.wa_message_id === pendingQuotedRef.current.waMessageId) {
                (normalized as MessageItem).quoted_preview = pendingQuotedRef.current.preview;
                pendingQuotedRef.current = null;
              }
              const cid = data.chat_id;
              setMessagesByChatId((prev) => {
                const cur = prev[cid];
                if (!cur) return prev;
                return { ...prev, [cid]: { ...cur, messages: mergeMessages(cur.messages, [normalized]) } };
              });
              scrollAfterSendRef.current = true;
            }
            setChats((prev) => {
              const idx = prev.findIndex((c) => c.id === data.chat_id);
              if (idx >= 0) {
                const next = [...prev];
                const created = data.message?.created_at;
                const lastAt = typeof created === 'string' ? created : (created ? new Date(created).toISOString() : next[idx].last_message_at);
                const preview = (data.message?.content || '').trim();
                next[idx] = {
                  ...next[idx],
                  last_message_preview: (preview || '[Mídia]').slice(0, 50),
                  last_message_at: lastAt ?? next[idx].last_message_at,
                };
                return sortChatsByLastMessage(next);
              }
              return prev;
            });
            if (isCurrentChat && data.message) {
              const created = data.message?.created_at;
              const lastAt = typeof created === 'string' ? created : (created ? new Date(created).toISOString() : new Date().toISOString());
              const preview = (data.message?.content || '').trim();
              setSelectedChat((prev) =>
                prev && prev.id === data.chat_id
                  ? { ...prev, last_message_preview: (preview || '[Mídia]').slice(0, 50), last_message_at: lastAt }
                  : prev
              );
            }
            const inList = chatsRef.current.some((c) => c.id === data.chat_id);
            if (data.chat_id && !inList && instanceIdRef.current) {
              chatService.getChats(instanceIdRef.current, 100).then((list: ChatItem[]) => {
                setChats(sortChatsByLastMessage(Array.isArray(list) ? list : []));
              }).catch(() => {});
            }

            if (isIncoming) {
              const notifSettings = getNotificationSettings();
              if (notifSettings.notificationsEnabled) {
                const shouldNotify = document.hidden || data.chat_id !== currentChatId;
                if (shouldNotify) {
                  const preview = (data.message?.content || '[Mídia]').slice(0, 60);
                  const title = 'Nova mensagem';
                  const chat = chatsRef.current.find((c) => c.id === data.chat_id);
                  const chatName = chat?.name?.trim() || (chat?.remote_jid || '').split('@')[0] || 'Contato';
                  const isAguardando = chat?.status === 'aguardando';
                  addNotificationRef.current?.({
                    type: isAguardando ? 'new_chat_aguardando' : 'new_message',
                    title: isAguardando ? 'Nova conversa em aguardando' : 'Nova mensagem',
                    body: chatName ? `${chatName}: ${preview}` : preview,
                    chatId: data.chat_id,
                    instanceId: instanceIdRef.current,
                    chatName: chatName || undefined,
                  });
                  if (document.hidden) {
                    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                      try {
                        new Notification(title, { body: preview, icon: '/favicon.ico', tag: `chat-${data.chat_id}` });
                      } catch (_) {}
                      const baseTitle = document.title.replace(/^\(\d+\)\s*/, '') || 'WhatsMiau - Dashboard';
                      const match = document.title.match(/^\((\d+)\)/);
                      const n = match ? parseInt(match[1], 10) + 1 : 1;
                      document.title = `(${n}) ${baseTitle}`;
                    }
                  }
                  if (notifSettings.soundEnabled) {
                    try {
                      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                      const osc = ctx.createOscillator();
                      const gain = ctx.createGain();
                      osc.connect(gain);
                      gain.connect(ctx.destination);
                      osc.frequency.value = 800;
                      osc.type = 'sine';
                      gain.gain.setValueAtTime(0.15, ctx.currentTime);
                      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
                      osc.start(ctx.currentTime);
                      osc.stop(ctx.currentTime + 0.15);
                    } catch (_) {}
                  }
                }
              }
            }
          } else if (type === 'message_status' && data) {
            const cid = data.chat_id;
            if (cid) {
              setMessagesByChatId((prev) => {
                const cur = prev[cid];
                if (!cur) return prev;
                return {
                  ...prev,
                  [cid]: {
                    ...cur,
                    messages: cur.messages.map((m) =>
                      m.wa_message_id === data.message_id ? { ...m, status: data.status } : m
                    ),
                  },
                };
              });
            }
          }
        } catch (_) {}
      };

      socket.onerror = () => {};

      socket.onclose = () => {
        setWsConnected(false);
        setWs(null);
        socketRef.current = null;
        if (cancelled) return;
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, 15000);
        }, reconnectDelayRef.current);
      };

      setWs(socket);
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        try {
          socketRef.current.onclose = () => {};
          socketRef.current.close();
        } catch (_) {}
        socketRef.current = null;
      }
      setWs(null);
    };
  }, [wsUrl]);

  // Ao voltar para a aba: limpar badge e recarregar mensagens do chat atual (catch-up se perdeu algum evento WS)
  const loadMessagesRef = useRef<(chatId: string, beforeId?: string) => void>(() => {});
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      document.title = document.title.replace(/^\(\d+\)\s*/, '') || 'WhatsMiau - Dashboard';
      const chat = selectedChatRef.current;
      if (chat?.id && instanceIdRef.current) {
        chatService.getChats(instanceIdRef.current, 100).then((list: ChatItem[]) => {
          setChats(sortChatsByLastMessage(Array.isArray(list) ? list : []));
        }).catch(() => {});
        loadMessagesRef.current(chat.id);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Mantém o objeto do chat selecionado sincronizado com a lista (status/setor/preview/hora em tempo real)
  useEffect(() => {
    if (!selectedChat) return;
    const live = chats.find((c) => c.id === selectedChat.id);
    if (!live) return;
    if (
      live.status === selectedChat.status &&
      (live.sector_id || '') === (selectedChat.sector_id || '') &&
      (live.last_message_preview || '') === (selectedChat.last_message_preview || '') &&
      (live.last_message_at || '') === (selectedChat.last_message_at || '') &&
      (live.name || '') === (selectedChat.name || '')
    ) {
      return;
    }
    setSelectedChat((prev) => (prev && prev.id === live.id ? { ...prev, ...live } : prev));
  }, [chats, selectedChat]);

  // Fallback de tempo real: se o WS oscilar/perder evento, sincroniza periodicamente chats e mensagens
  useEffect(() => {
    if (!instanceId) return;
    let cancelled = false;

    const syncNow = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const list = await chatService.getChats(instanceId, 100);
        if (cancelled) return;
        const sorted = sortChatsByLastMessage(Array.isArray(list) ? list : []);
        setChats(sorted);

        const current = selectedChatRef.current;
        if (!current?.id) return;
        const rawMessages = await chatService.getMessages(instanceId, current.id, { limit: MESSAGES_PAGE_SIZE });
        if (cancelled) return;
        const latest = (Array.isArray(rawMessages) ? rawMessages : []).slice().reverse() as MessageItem[];
        setMessagesByChatId((prev) => ({
          ...prev,
          [current.id]: {
            messages: mergeMessagesForChat(current.id, [], latest),
            hasMore: (Array.isArray(rawMessages) ? rawMessages : []).length >= MESSAGES_PAGE_SIZE,
          },
        }));
      } catch {
        // Silencioso para não poluir UX; WS segue tentando reconectar.
      }
    };

    const everyMs = wsConnected ? 5000 : 2500;
    const timer = setInterval(syncNow, everyMs);
    syncNow();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [instanceId, wsConnected]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingInstances(true);
      try {
        const data = await instanceService.list();
        const list = Array.isArray(data) ? data : [];
        const items = list.map((item: any) => ({
          id: item.instance?.id || item.instanceName || item.id || String(item),
          instanceName: item.instanceName || item.instance?.id || item.id,
        }));
        if (!cancelled && items.length > 0) {
          setInstances(items);
          const state = location.state as { instanceId?: string; chatId?: string } | null;
          if (state?.instanceId && items.some((i: { id: string }) => i.id === state.instanceId)) {
            setInstanceId(state.instanceId);
          } else if (!instanceId) {
            setInstanceId(items[0].id);
          }
        }
      } catch (e) {
        if (!cancelled) toast.error('Erro ao carregar instâncias');
      } finally {
        if (!cancelled) setLoadingInstances(false);
      }
    })();
    return () => { cancelled = true; };
  }, [location.state]);

  // Abrir chat vindo do Kanban (state.instanceId + state.chatId)
  const openedFromKanbanRef = useRef(false);
  useEffect(() => {
    const s = location.state as { instanceId?: string; chatId?: string } | null;
    if (!s?.chatId || !instanceId || s.instanceId !== instanceId || loadingChats || openedFromKanbanRef.current) return;
    const chat = chats.find((c) => c.id === s.chatId);
    if (chat) {
      setSelectedChat(chat);
      openedFromKanbanRef.current = true;
      navigate('/chat', { replace: true, state: {} });
    }
  }, [chats, instanceId, loadingChats, location.state, navigate]);

  useEffect(() => {
    if (!instanceId) {
      setChats([]);
      setSelectedChat(null);
      return;
    }
    let cancelled = false;
    setLoadingChats(true);
    setSelectedChat(null);
    setMessagesByChatId({});
    (async () => {
      try {
        const data = await chatService.getChats(instanceId, 100);
        if (!cancelled) setChats(sortChatsByLastMessage(Array.isArray(data) ? data : []));
      } catch (e: any) {
        if (!cancelled) {
          setChats([]);
          const status = e.response?.status;
          const msg = e.response?.data?.message;
          if (status === 404) {
            toast.error(msg && msg.toLowerCase().includes('instance') ? 'Instância não encontrada.' : 'Rota de conversas não disponível.');
          } else if (status === 403 || status === 401) {
            toast.error('Sem permissão para ver conversas.');
          } else if (!e.response) {
            toast.error('Backend inacessível. Verifique se está rodando (ex.: porta 8080).');
          } else {
            toast.error(msg || 'Erro ao carregar conversas.');
          }
        }
      } finally {
        if (!cancelled) setLoadingChats(false);
      }
    })();
    return () => { cancelled = true; };
  }, [instanceId]);

  // Pré-carrega tags de cada chat da instância para exibir bolinhas e permitir filtro por tag.
  useEffect(() => {
    if (!instanceId || chats.length === 0) {
      setChatTagSummary({});
      return;
    }
    let cancelled = false;
    (async () => {
      const summary: Record<string, Array<{ id: string; name: string; color?: string }>> = {};
      for (const chat of chats) {
        try {
          const list = await tagService.listByChat(instanceId, chat.id);
          if (cancelled) return;
          summary[chat.id] = Array.isArray(list) ? list : [];
        } catch {
          if (cancelled) return;
          summary[chat.id] = [];
        }
      }
      if (!cancelled) setChatTagSummary(summary);
    })();
    return () => {
      cancelled = true;
    };
  }, [instanceId, chats]);

  useEffect(() => {
    if (!instanceId) {
      setSectors([]);
      return;
    }
    sectorService
      .list()
      .then((list) => setSectors(Array.isArray(list) ? list : []))
      .catch(() => setSectors([]));
  }, [instanceId]);

  const loadMessages = useCallback(async (chatId: string, beforeId?: string) => {
    if (!instanceId) return;
    setLoadingMessages(true);
    try {
      const data = await chatService.getMessages(instanceId, chatId, { limit: MESSAGES_PAGE_SIZE, before_id: beforeId });
      const list = Array.isArray(data) ? data : [];
      const reversed = list.slice().reverse() as MessageItem[];
      const hasMore = list.length >= MESSAGES_PAGE_SIZE;

      if (beforeId) {
        const container = messagesContainerRef.current;
        if (container && selectedChatRef.current?.id === chatId) {
          scrollRestoreRef.current = { chatId, scrollHeight: container.scrollHeight, scrollTop: container.scrollTop };
        }
        setMessagesByChatId((prev) => {
          const cur = prev[chatId];
          if (!cur) return prev;
          const merged = mergeMessagesForChat(chatId, cur.messages, reversed);
          return { ...prev, [chatId]: { messages: merged, hasMore } };
        });
      } else {
        setMessagesByChatId((prev) => ({
          ...prev,
          [chatId]: { messages: mergeMessagesForChat(chatId, [], reversed), hasMore },
        }));
      }
    } catch (e) {
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoadingMessages(false);
    }
  }, [instanceId]);
  loadMessagesRef.current = loadMessages;

  useEffect(() => {
    if (!scrollRestoreRef.current || !selectedChat) return;
    const { chatId, scrollHeight: oldHeight, scrollTop: oldTop } = scrollRestoreRef.current;
    if (chatId !== selectedChat.id) return;
    scrollRestoreRef.current = null;
    const container = messagesContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      const newHeight = container.scrollHeight;
      container.scrollTop = Math.max(0, newHeight - oldHeight + oldTop);
    });
  }, [messagesByChatId, selectedChat?.id]);

  useEffect(() => {
    if (!selectedChat) return;
    scrollWhenOpeningRef.current = true;
    loadMessages(selectedChat.id);
  }, [selectedChat?.id, loadMessages]);

  const openChat = useCallback((chat: ChatItem) => {
    const isSameChat = selectedChatRef.current?.id === chat.id;
    scrollWhenOpeningRef.current = true;
    setSelectedChat(chat);
    if (isSameChat) {
      loadMessages(chat.id).finally(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => scrollToConversationBottom('smooth'));
        });
      });
    }
  }, [loadMessages, scrollToConversationBottom]);

  useEffect(() => {
    if (!instanceId || !selectedChat) {
      setChatTags([]);
      return;
    }
    tagService
      .listByChat(instanceId, selectedChat.id)
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        setChatTags(arr);
        setChatTagSummary((prev) => ({ ...prev, [selectedChat.id]: arr }));
      })
      .catch(() => {
        setChatTags([]);
      });
  }, [instanceId, selectedChat?.id]);

  useEffect(() => {
    if (!instanceId) return;
    tagService.list().then((list) => setAllTags(Array.isArray(list) ? list : [])).catch(() => setAllTags([]));
  }, [instanceId]);

  useEffect(() => {
    quickRepliesService.list().then((list) => setQuickRepliesList(Array.isArray(list) ? list : [])).catch(() => setQuickRepliesList([]));
  }, []);

  useEffect(() => {
    flowService.list().then((list) => {
      const arr = Array.isArray(list) ? list : [];
      setFlowsList(arr.map((f) => ({ id: f.id, command: f.command, name: f.name })));
    }).catch(() => setFlowsList([]));
  }, []);

  useEffect(() => {
    if (editTarget) setEditText(editTarget.content || '');
  }, [editTarget]);

  const handleSend = async () => {
    if (!instanceId || !selectedChat || !inputText.trim()) return;
    const number = parseJidToNumber(selectedChat.remote_jid);
    if (!number) {
      toast.error('Número inválido');
      return;
    }
    setSending(true);
    const sentPreview = inputText.trim().slice(0, 50);
    const sentAt = new Date().toISOString();
    const quoted = replyToMessage
      ? {
          key: {
            id: replyToMessage.wa_message_id,
            remoteJid: selectedChat.remote_jid,
            fromMe: replyToMessage.from_me,
          },
          message: { conversation: replyToMessage.content || '' },
        }
      : undefined;
    try {
      const res = await messageService.sendText(instanceId, number, inputText.trim(), quoted);
      setInputText('');
      const hadReply = !!replyToMessage;
      const quotedPreview = replyToMessage?.content?.slice(0, 200) ?? '';
      setReplyToMessage(null);
      if (hadReply && quotedPreview && res?.key?.id) {
        pendingQuotedRef.current = { waMessageId: res.key.id, preview: quotedPreview };
      }
      await loadMessages(selectedChat.id);
      if (pendingQuotedRef.current && selectedChat) {
        const { waMessageId, preview } = pendingQuotedRef.current;
        pendingQuotedRef.current = null;
        const cid = selectedChat.id;
        setMessagesByChatId((prev) => {
          const cur = prev[cid];
          if (!cur) return prev;
          return {
            ...prev,
            [cid]: {
              ...cur,
              messages: cur.messages.map((m) =>
                m.from_me && m.wa_message_id === waMessageId ? { ...m, quoted_preview: preview } : m
              ),
            },
          };
        });
      }
      setChats((prev) => {
        const idx = prev.findIndex((c) => c.id === selectedChat.id);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          last_message_preview: sentPreview,
          last_message_at: sentAt,
        };
        return sortChatsByLastMessage(next);
      });
      scrollAfterSendRef.current = true;
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || 'Erro ao enviar');
    } finally {
      setSending(false);
    }
  };

  const sendWithText = useCallback(async (text: string) => {
    if (!instanceId || !selectedChat || !text.trim()) return;
    const number = parseJidToNumber(selectedChat.remote_jid);
    if (!number) return;
    setSending(true);
    const sentPreview = text.trim().slice(0, 50);
    const sentAt = new Date().toISOString();
    const quoted = replyToMessage
      ? {
          key: {
            id: replyToMessage.wa_message_id,
            remoteJid: selectedChat.remote_jid,
            fromMe: replyToMessage.from_me,
          },
          message: { conversation: replyToMessage.content || '' },
        }
      : undefined;
    try {
      await messageService.sendText(instanceId, number, text.trim(), quoted);
      setInputText('');
      setReplyToMessage(null);
      await loadMessages(selectedChat.id);
      setChats((prev) => {
        const idx = prev.findIndex((c) => c.id === selectedChat.id);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], last_message_preview: sentPreview, last_message_at: sentAt };
        return sortChatsByLastMessage(next);
      });
      scrollAfterSendRef.current = true;
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || 'Erro ao enviar');
    } finally {
      setSending(false);
    }
  }, [instanceId, selectedChat, replyToMessage, loadMessages]);

  useEffect(() => {
    const shouldScroll = scrollAfterSendRef.current || scrollWhenOpeningRef.current;
    if (!shouldScroll) return;
    scrollAfterSendRef.current = false;
    scrollWhenOpeningRef.current = false;
    const sentinel = messagesEndRef.current;
    const container = messagesContainerRef.current;
    const scrollToBottom = () => {
      if (sentinel) {
        sentinel.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } else if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom();
        if (messages.length > 20) {
          setTimeout(scrollToBottom, 150);
        }
      });
    });
  }, [messages]);

  const quickReplyFilter = inputText.startsWith('/') ? inputText.slice(1).trim().toLowerCase() : '';
  const filteredQuickReplies = useMemo(() => {
    if (!quickReplyFilter) return quickRepliesList;
    return quickRepliesList.filter((q) => q.command.toLowerCase().includes(quickReplyFilter));
  }, [quickRepliesList, quickReplyFilter]);
  const showQuickReplyDropdown = inputText.startsWith('/') && selectedChat?.status === 'atendendo' && !sending;

  const flowFilter = inputText.startsWith('\\') ? inputText.slice(1).trim().toLowerCase() : '';
  const filteredFlows = useMemo(() => {
    if (!flowFilter) return flowsList;
    return flowsList.filter((f) => (f.command || '').toLowerCase().includes(flowFilter));
  }, [flowsList, flowFilter]);
  const showFlowDropdown = inputText.startsWith('\\') && selectedChat?.status === 'atendendo' && !sending;

  const handleQuickReplyKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showQuickReplyDropdown || filteredQuickReplies.length === 0) {
      if (e.key === 'Escape') setInputText('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setQuickReplyHighlightIndex((i) => Math.min(i + 1, filteredQuickReplies.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setQuickReplyHighlightIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = filteredQuickReplies[quickReplyHighlightIndex];
      if (item) {
        sendWithText(item.message);
        setInputText('');
        setQuickReplyHighlightIndex(0);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setInputText('');
      setQuickReplyHighlightIndex(0);
    }
  }, [showQuickReplyDropdown, filteredQuickReplies, quickReplyHighlightIndex, sendWithText]);

  useEffect(() => {
    if (showQuickReplyDropdown) setQuickReplyHighlightIndex(0);
  }, [quickReplyFilter, showQuickReplyDropdown]);

  const runFlow = useCallback(async (flowId: string) => {
    if (!instanceId || !selectedChat) return;
    const number = parseJidToNumber(selectedChat.remote_jid);
    if (!number) {
      toast.error('Número inválido para executar fluxo');
      return;
    }
    try {
      const data = await flowService.get(flowId);
      const def: any = (data.definition as any) || {};
      const sequence: any[] = Array.isArray(def.sequence) ? def.sequence : [];
      if (sequence.length === 0) {
        toast.error('Fluxo sem passos definidos');
        return;
      }
      for (const step of sequence) {
        const type = step.type;
        const props = step.properties || {};
        if (type === 'trigger') {
          continue;
        }
        if (type === 'delay') {
          const seconds = Number(props.delaySeconds) || 1;
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
          continue;
        }
        if (type === 'typing') {
          const seconds = Number(props.durationSeconds) || 3;
          try {
            // eslint-disable-next-line no-await-in-loop
            await chatService.sendPresence(instanceId, number);
          } catch {
            // ignore
          }
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
          continue;
        }
        if (type === 'sendText') {
          const text = String(props.text || '').trim();
          if (!text) continue;
          // eslint-disable-next-line no-await-in-loop
          await messageService.sendText(instanceId, number, text);
          continue;
        }
        if (type === 'sendMedia') {
          const url = String(props.url || '').trim();
          const caption = String(props.caption || '').trim();
          if (!url) continue;
          // aqui usamos envio de documento genérico se não soubermos o tipo
          // eslint-disable-next-line no-await-in-loop
          await messageService.sendDocument(instanceId, number, url, caption || 'arquivo');
          continue;
        }
        if (type === 'sendAudio') {
          const url = String(props.url || '').trim();
          if (!url) continue;
          // eslint-disable-next-line no-await-in-loop
          await messageService.sendAudio(instanceId, number, url);
          continue;
        }
      }
      toast.success('Fluxo executado');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao executar fluxo');
    }
  }, [instanceId, selectedChat]);

  const handleFlowKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showFlowDropdown || filteredFlows.length === 0) {
      if (e.key === 'Escape') setInputText('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFlowHighlightIndex((i) => Math.min(i + 1, filteredFlows.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFlowHighlightIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = filteredFlows[flowHighlightIndex];
      if (item) {
        runFlow(item.id);
        setInputText('');
        setFlowHighlightIndex(0);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setInputText('');
      setFlowHighlightIndex(0);
    }
  }, [showFlowDropdown, filteredFlows, flowHighlightIndex, runFlow]);

  useEffect(() => {
    if (showFlowDropdown) setFlowHighlightIndex(0);
  }, [flowFilter, showFlowDropdown]);

  const insertEmoji = useCallback((emoji: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? inputText.length;
      const end = input.selectionEnd ?? inputText.length;
      const before = inputText.slice(0, start);
      const after = inputText.slice(end);
      setInputText(before + emoji + after);
      requestAnimationFrame(() => {
        input.focus();
        const pos = start + emoji.length;
        input.setSelectionRange(pos, pos);
      });
    } else {
      setInputText((prev) => prev + emoji);
    }
  }, [inputText]);

  const filteredChats = useMemo(() => {
    return chats.filter((c) => {
      const statusOk = (c.status || 'aguardando') === activeQueue;
      if (!statusOk) return false;
      if (activeSectorFilterId && c.sector_id !== activeSectorFilterId) return false;
      if (!activeTagFilterId) return true;
      const tags = chatTagSummary[c.id] || [];
      return tags.some((t) => t.id === activeTagFilterId);
    });
  }, [chats, activeQueue, activeSectorFilterId, activeTagFilterId, chatTagSummary]);

  const geralSector = useMemo(
    () => sectors.find((s) => s.is_default),
    [sectors]
  );

  const sectorMap = useMemo(
    () =>
      sectors.reduce<Record<string, { id: string; name: string; is_default?: boolean }>>(
        (acc, s) => {
          acc[s.id] = s;
          return acc;
        },
        {}
      ),
    [sectors]
  );

  const currentSectorName = useMemo(() => {
    if (!selectedChat) return '';
    const sid = selectedChat.sector_id || '';
    if (sid) {
      const found = sectorMap[sid];
      if (found) return found.name;
    }
    if (geralSector) return geralSector.name;
    return 'Sem setor';
  }, [selectedChat, sectorMap, geralSector]);

  const handleAttend = async (chat: ChatItem) => {
    if (!instanceId) return;
    setChangingStatus(true);
    try {
      await fetch(`/v1/instance/${instanceId}/chats/${chat.id}/attend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      setChats((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, status: 'atendendo' } : c))
      );
      setSelectedChat((prev) => (prev && prev.id === chat.id ? { ...prev, status: 'atendendo' } : prev));
    } catch {
      toast.error('Erro ao mudar status para atendendo');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleFinish = async (chat: ChatItem) => {
    if (!instanceId) return;
    setChangingStatus(true);
    try {
      await fetch(`/v1/instance/${instanceId}/chats/${chat.id}/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      setChats((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, status: 'finalizado' } : c))
      );
      setSelectedChat((prev) => (prev && prev.id === chat.id ? { ...prev, status: 'finalizado' } : prev));
    } catch {
      toast.error('Erro ao finalizar atendimento');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleChangeSector = async (chat: ChatItem, sectorId: string | null) => {
    if (!instanceId) return;
    setChangingSector(true);
    try {
      await fetch(`/v1/instance/${instanceId}/chats/${chat.id}/sector`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ sector_id: sectorId }),
      });
      setChats((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, sector_id: sectorId || undefined } : c))
      );
      if (selectedChat?.id === chat.id) {
        setSelectedChat({ ...chat, sector_id: sectorId || undefined });
      }
    } catch {
      toast.error('Erro ao transferir setor');
    } finally {
      setChangingSector(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      {/* Header - respeita tema claro/escuro */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-600 text-white flex-shrink-0">
          <MessageCircle size={22} />
        </div>
        <h1 className="text-lg font-medium text-gray-900 dark:text-white flex-1">Chat</h1>
        <select
          value={instanceId}
          onChange={(e) => setInstanceId(e.target.value)}
          disabled={loadingInstances}
          className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
        >
          <option value="">Selecione a instância</option>
          {instances.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.instanceName || inst.id}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Lista de conversas + filas */}
        <aside className="w-80 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-700">
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-900 p-1">
              {(['aguardando', 'atendendo', 'finalizado'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setActiveQueue(status)}
                  className={`flex-1 px-2 py-1 rounded-md text-xs font-medium capitalize ${
                    activeQueue === status
                      ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          {/* Filtros: Tags e Setor em duas colunas */}
          <div className="px-3 pt-2 pb-3 border-b border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Tags
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-200 px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  value={activeTagFilterId || ''}
                  onChange={(e) => setActiveTagFilterId(e.target.value || null)}
                >
                  <option value="">Todas</option>
                  {allTags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Setor
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-200 px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  value={activeSectorFilterId || ''}
                  onChange={(e) => setActiveSectorFilterId(e.target.value || null)}
                >
                  <option value="">Todos</option>
                  {sectors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {loadingChats ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="animate-spin text-primary-600" size={32} />
            </div>
          ) : (
            <ul className="overflow-y-auto flex-1">
              {filteredChats.map((chat) => (
                <li key={chat.id}>
                  <button
                    type="button"
                    onClick={() => openChat(chat)}
                    className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 border-b border-gray-100 dark:border-gray-700 ${
                      selectedChat?.id === chat.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <ChatAvatar
                      instanceId={instanceId}
                      remoteJid={chat.remote_jid}
                      displayLetter={getAvatarLetter(chat)}
                      size="md"
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {getChatDisplayName(chat)}
                      </div>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        {chat.last_message_preview ? (
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {chat.last_message_preview}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {chat.last_message_at
                              ? new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Sem mensagens'}
                          </div>
                        )}
                        {/* Indicação visual do setor da conversa */}
                        <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                          {(() => {
                            const sid = chat.sector_id || '';
                            const s = sid ? sectorMap[sid] : geralSector;
                            if (!s) return 'Setor: não definido';
                            if (s.is_default) return 'Setor: Geral (apenas admins)';
                            return `Setor: ${s.name}`;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {chat.last_message_at && (
                        <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                          {new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {/* Bolinhas de tags do chat */}
                      <div className="flex items-center gap-1">
                        {(chatTagSummary[chat.id] || []).slice(0, 3).map((t) => (
                          <span
                            key={t.id}
                            className="w-2.5 h-2.5 rounded-full border border-white dark:border-gray-800 shadow-sm"
                            style={{ backgroundColor: t.color || '#6B7280' }}
                            title={t.name}
                          />
                        ))}
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
                        {(chat.status || 'aguardando').toUpperCase()}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
              {!loadingChats && chats.length === 0 && instanceId && (
                <li className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  Nenhuma conversa ainda. As conversas aparecem quando você envia ou recebe mensagens nesta instância.
                </li>
              )}
            </ul>
          )}
        </aside>

        {/* Área da conversa */}
        <main className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900">
          {!selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50">
              <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-4">
                <MessageCircle size={48} className="text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-lg text-gray-700 dark:text-gray-300">Mantenha seu celular conectado</p>
              <p className="text-sm mt-1">O WhatsApp conecta ao seu celular para sincronizar as mensagens.</p>
            </div>
          ) : (
            <>
              {/* Cabeçalho do chat */}
              <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <ChatAvatar
                  instanceId={instanceId}
                  remoteJid={selectedChat.remote_jid}
                  displayLetter={getAvatarLetter(selectedChat)}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <h2 className="font-medium text-gray-900 dark:text-white truncate">
                    {getChatDisplayName(selectedChat)}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {parseJidToNumber(selectedChat.remote_jid) || selectedChat.remote_jid}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {chatTags.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
                        style={t.color ? { backgroundColor: t.color + '30', color: t.color } : undefined}
                      >
                        {t.name}
                        <button
                          type="button"
                          onClick={() => {
                            tagService
                              .removeFromChat(instanceId, selectedChat.id, t.id)
                              .then(() => {
                                setChatTags((prev) => prev.filter((x) => x.id !== t.id));
                                setChatTagSummary((prev) => {
                                  const next = { ...(prev || {}) };
                                  const prevTags = next[selectedChat.id] || [];
                                  next[selectedChat.id] = prevTags.filter((x) => x.id !== t.id);
                                  return next;
                                });
                              })
                              .catch(() => toast.error('Erro ao remover tag'));
                          }}
                          className="hover:opacity-80"
                          aria-label="Remover tag"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-gray-400 dark:border-gray-500 text-gray-500 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
                        aria-label="Adicionar tag"
                      >
                        <TagIcon size={12} />
                        Tag
                      </button>
                      {tagDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setTagDropdownOpen(false)} />
                          <div className="absolute left-0 top-full mt-1 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 min-w-[140px] max-h-48 overflow-y-auto">
                            {allTags.filter((t) => !chatTags.some((ct) => ct.id === t.id)).length === 0 ? (
                              <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">Nenhuma tag disponível</p>
                            ) : (
                              allTags
                                .filter((t) => !chatTags.some((ct) => ct.id === t.id))
                                .map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                    onClick={() => {
                                      tagService
                                        .addToChat(instanceId, selectedChat.id, t.id)
                                        .then(() => {
                                          setChatTags((prev) => [...prev, t]);
                                          setChatTagSummary((prev) => {
                                            const next = { ...(prev || {}) };
                                            const prevTags = next[selectedChat.id] || [];
                                            next[selectedChat.id] = [...prevTags, t];
                                            return next;
                                          });
                                          setTagDropdownOpen(false);
                                        })
                                        .catch(() => toast.error('Erro ao adicionar tag'));
                                    }}
                                  >
                                    {t.color && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />}
                                    {t.name}
                                  </button>
                                ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Setor atual e transferência */}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Setor:</span>
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                      {currentSectorName}
                    </span>
                    {sectors.length > 0 && (
                      <>
                        <span className="text-gray-400 dark:text-gray-500">·</span>
                        <select
                          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-[11px] px-2 py-0.5 text-gray-700 dark:text-gray-200"
                          value={selectedChat.sector_id || ''}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            handleChangeSector(selectedChat, val);
                          }}
                          disabled={changingSector}
                        >
                          <option value="">{geralSector ? geralSector.name : 'Sem setor'}</option>
                          {sectors
                            .filter((s) => !s.is_default)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                        {geralSector && (
                          <button
                            type="button"
                            onClick={() => handleChangeSector(selectedChat, geralSector.id)}
                            disabled={changingSector}
                            className="px-2 py-0.5 rounded-md border border-dashed border-gray-400 dark:border-gray-500 text-[11px] text-gray-600 dark:text-gray-300 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
                          >
                            Enviar para Geral
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {selectedChat.status === 'atendendo' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowScheduleModal(true);
                        const now = new Date();
                        now.setMinutes(now.getMinutes() + 30);
                        setScheduleDate(now.toISOString().slice(0, 10));
                        setScheduleTime(String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'));
                        setScheduleContent('');
                        setScheduleMediaUrl('');
                        setScheduleType('text');
                        setScheduleUploadedFile(null);
                      }}
                      className="ml-2 px-3 py-1.5 rounded-md bg-primary-600 text-white text-xs font-medium hover:bg-primary-700"
                    >
                      <Calendar size={14} className="inline mr-1" />
                      Agendar mensagem
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFinishModal(true)}
                      disabled={changingStatus}
                      className="ml-2 px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-50"
                    >
                      Finalizar atendimento
                    </button>
                  </>
                )}
              </div>
              {/* Área de mensagens */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50 dark:bg-gray-900"
                style={theme === 'dark' ? { backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%231f2937\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/svg%3E")' } : undefined}
              >
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-primary-600" size={28} />
                  </div>
                ) : (
                  <>
                    {hasMoreOlder && selectedChat && (
                      <div className="flex justify-center py-2">
                        <button
                          type="button"
                          onClick={() => loadMessages(selectedChat.id, messages[0]?.id)}
                          disabled={loadingMessages}
                          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 inline-flex items-center gap-2"
                        >
                          {loadingMessages ? <Loader2 className="animate-spin" size={18} /> : null}
                          Carregar mensagens anteriores
                        </button>
                      </div>
                    )}
                    {messages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        instanceId={instanceId}
                        chatId={selectedChat?.id ?? ''}
                        remoteJid={selectedChat?.remote_jid ?? ''}
                        onReply={setReplyToMessage}
                        reactionEmoji={reactions[msg.id]}
                        onReact={async (m, emoji) => {
                          if (!instanceId || !selectedChat || !m.wa_message_id) return;
                          try {
                            await messageService.sendReaction(instanceId, {
                              remoteJid: selectedChat.remote_jid,
                              id: m.wa_message_id,
                              fromMe: m.from_me,
                            }, emoji);
                            setReactions((r) => ({ ...r, [m.id]: emoji }));
                          } catch (e) {
                            toast.error('Erro ao enviar reação');
                          }
                        }}
                        onRevoke={selectedChat ? (m) => setRevokeTarget(m) : undefined}
                        onEdit={selectedChat ? (m) => setEditTarget(m) : undefined}
                      />
                    ))}
                    <div ref={messagesEndRef} className="min-h-0 w-full shrink-0" aria-hidden="true" />
                  </>
                )}
              </div>
              {/* Modal Apagar mensagem */}
              {revokeTarget && selectedChat && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Apagar mensagem"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-600 p-5 max-w-sm w-full">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Apagar mensagem?</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Esta mensagem será apagada para todos. Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        disabled={revoking}
                        onClick={() => setRevokeTarget(null)}
                        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={revoking}
                        onClick={async () => {
                          if (!instanceId || !selectedChat) return;
                          setRevoking(true);
                          try {
                            await messageService.revokeMessage(instanceId, {
                              remoteJid: selectedChat.remote_jid,
                              id: revokeTarget.wa_message_id,
                              fromMe: revokeTarget.from_me,
                            });
                            setMessagesByChatId((prev) => {
                              if (!selectedChat) return prev;
                              const cur = prev[selectedChat.id];
                              if (!cur) return prev;
                              return {
                                ...prev,
                                [selectedChat.id]: {
                                  ...cur,
                                  messages: cur.messages.filter((m) => m.id !== revokeTarget.id),
                                },
                              };
                            });
                            setRevokeTarget(null);
                            toast.success('Mensagem apagada');
                          } catch (e: any) {
                            toast.error(e.response?.data?.message || e.message || 'Erro ao apagar');
                          } finally {
                            setRevoking(false);
                          }
                        }}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {revoking ? 'Apagando…' : 'Apagar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Editar mensagem */}
              {editTarget && selectedChat && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Editar mensagem"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-600 p-5 max-w-md w-full">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Editar mensagem</h3>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-h-[100px] resize-y"
                      placeholder="Texto da mensagem"
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end mt-4">
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => { setEditTarget(null); setEditText(''); }}
                        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit || !editText.trim()}
                        onClick={async () => {
                          if (!instanceId || !selectedChat || !editText.trim()) return;
                          setSavingEdit(true);
                          try {
                            await messageService.editMessage(instanceId, {
                              remoteJid: selectedChat.remote_jid,
                              id: editTarget.wa_message_id,
                            }, editText.trim());
                            setMessagesByChatId((prev) => {
                              if (!selectedChat) return prev;
                              const cur = prev[selectedChat.id];
                              if (!cur) return prev;
                              return {
                                ...prev,
                                [selectedChat.id]: {
                                  ...cur,
                                  messages: cur.messages.map((m) =>
                                    m.id === editTarget.id ? { ...m, content: editText.trim() } : m
                                  ),
                                },
                              };
                            });
                            setEditTarget(null);
                            setEditText('');
                            toast.success('Mensagem editada');
                          } catch (e: any) {
                            toast.error(e.response?.data?.message || e.message || 'Erro ao editar');
                          } finally {
                            setSavingEdit(false);
                          }
                        }}
                        className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                      >
                        {savingEdit ? 'Salvando…' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Campo de digitação + emojis */}
              <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                {selectedChat.status !== 'atendendo' && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                    <p className="text-xs text-amber-800 dark:text-amber-100">
                      Esta conversa está em fila <strong>{(selectedChat.status || 'aguardando')}</strong>. Clique em <strong>Realizar atendimento</strong> para poder enviar mensagens.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAttend(selectedChat)}
                      disabled={changingStatus}
                      className="px-3 py-1.5 rounded-md bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 disabled:opacity-50"
                    >
                      {changingStatus ? 'Mudando...' : 'Realizar atendimento'}
                    </button>
                  </div>
                )}
                {replyToMessage && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border-l-4 border-primary-500">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-primary-600 dark:text-primary-400">Respondendo</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {replyToMessage.content?.slice(0, 60) || (replyToMessage.message_type ? 'Mídia' : '')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyToMessage(null)}
                      className="p-1.5 rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      aria-label="Cancelar resposta"
                    >
                      <span className="text-lg leading-none">×</span>
                    </button>
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1 flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((p) => !p)}
                      className="flex-shrink-0 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      aria-label="Emojis"
                    >
                      <Smile size={22} />
                    </button>
                    {showEmojiPicker && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          aria-hidden="true"
                          onClick={() => setShowEmojiPicker(false)}
                        />
                        <div className="absolute bottom-full left-0 mb-1 w-72 max-h-48 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg p-2 grid grid-cols-8 gap-1 z-20">
                          {EMOJI_LIST.map((emoji, i) => (
                            <button
                              key={i}
                              type="button"
                              className="text-xl p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              onClick={() => {
                                insertEmoji(emoji);
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {showQuickReplyDropdown && (
                      <>
                        <div className="absolute bottom-full left-0 right-0 mb-1 max-h-52 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg z-20 py-1">
                          {filteredQuickReplies.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">Nenhum comando encontrado</p>
                          ) : (
                            filteredQuickReplies.map((qr, i) => (
                              <button
                                key={qr.id}
                                type="button"
                                onClick={() => {
                                  sendWithText(qr.message);
                                  setInputText('');
                                  setQuickReplyHighlightIndex(0);
                                }}
                                onMouseEnter={() => setQuickReplyHighlightIndex(i)}
                                className={`w-full text-left px-4 py-2.5 flex flex-col gap-0.5 ${
                                  i === quickReplyHighlightIndex ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                              >
                                <span className="font-medium text-sm">/{qr.command}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{qr.message}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                    {showFlowDropdown && (
                      <>
                        <div className="absolute bottom-full left-0 right-0 mb-1 max-h-52 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg z-20 py-1">
                          {filteredFlows.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">Nenhum fluxo encontrado</p>
                          ) : (
                            filteredFlows.map((flow, i) => (
                              <button
                                key={flow.id}
                                type="button"
                                onClick={() => {
                                  runFlow(flow.id);
                                  setInputText('');
                                  setFlowHighlightIndex(0);
                                }}
                                onMouseEnter={() => setFlowHighlightIndex(i)}
                                className={`w-full text-left px-4 py-2.5 flex flex-col gap-0.5 ${
                                  i === flowHighlightIndex ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                              >
                                <span className="font-medium text-sm">
                                  \{String(flow.command || 'sem-comando').replace(/^\\+/, '')}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{flow.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (showQuickReplyDropdown && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
                          handleQuickReplyKeyDown(e);
                          return;
                        }
                        if (showFlowDropdown && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
                          handleFlowKeyDown(e);
                          return;
                        }
                        if (e.key === 'Enter' && !e.shiftKey && selectedChat?.status === 'atendendo') handleSend();
                      }}
                      placeholder="Digite uma mensagem, / para respostas rápidas ou \\\\ para fluxos"
                      className="flex-1 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 border-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm"
                      disabled={sending || selectedChat?.status !== 'atendendo'}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || !inputText.trim() || selectedChat.status !== 'atendendo'}
                    className="flex-shrink-0 p-2.5 rounded-full bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sending ? <Loader2 className="animate-spin" size={22} /> : <Send size={22} />}
                  </button>
                </div>
              </div>
              {showFinishModal && selectedChat && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Finalizar atendimento"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-600 p-5 max-w-sm w-full">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Finalizar atendimento?</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Esta conversa será movida para a fila de já atendidos. Você poderá retomá-la se chegar uma nova mensagem.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        disabled={changingStatus}
                        onClick={() => setShowFinishModal(false)}
                        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={changingStatus}
                        onClick={async () => {
                          await handleFinish(selectedChat);
                          setShowFinishModal(false);
                        }}
                        className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {changingStatus ? 'Finalizando…' : 'Finalizar atendimento'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {showScheduleModal && selectedChat && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Agendar mensagem"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-600 p-5 max-w-md w-full max-h-[90vh] overflow-y-auto">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Agendar mensagem para {selectedChat.name || selectedChat.remote_jid?.split('@')[0] || 'contato'}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      Número: {selectedChat.remote_jid?.replace(/@.*/, '')} · Instância: {selectedChat.instance_id}
                    </p>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const num = (selectedChat.remote_jid || '').replace(/@.*/, '').replace(/\D/g, '');
                        if (num.length < 10) {
                          toast.error('Número inválido.');
                          return;
                        }
                        if (scheduleType === 'text' && !scheduleContent.trim()) {
                          toast.error('Digite o texto da mensagem.');
                          return;
                        }
                        if (scheduleType !== 'text' && !scheduleMediaUrl.trim()) {
                          toast.error('Envie um arquivo ou informe a URL da mídia.');
                          return;
                        }
                        const dateStr = scheduleDate.trim();
                        const timeStr = scheduleTime.trim();
                        if (!dateStr || !timeStr) {
                          toast.error('Informe data e hora.');
                          return;
                        }
                        const scheduledAt = new Date(`${dateStr}T${timeStr}:00`).toISOString();
                        if (new Date(scheduledAt) <= new Date()) {
                          toast.error('Data/hora deve ser no futuro.');
                          return;
                        }
                        setScheduleSaving(true);
                        try {
                          await scheduledMessageService.create({
                            instance_id: selectedChat.instance_id,
                            number: num,
                            message_type: scheduleType,
                            content: scheduleContent.trim(),
                            media_url: scheduleType !== 'text' ? scheduleMediaUrl.trim() : '',
                            scheduled_at: scheduledAt,
                          });
                          toast.success('Mensagem agendada.');
                          setShowScheduleModal(false);
                        } catch (err: any) {
                          const status = err.response?.status;
                          const msg = err.response?.data?.message ?? err.message;
                          if (status === 404) {
                            toast.error('Rota de agendamento não encontrada (404). Verifique se a API está em /v1 e o backend está rodando.');
                          } else {
                            toast.error(typeof msg === 'string' ? msg : 'Erro ao agendar.');
                          }
                        } finally {
                          setScheduleSaving(false);
                        }
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
                        <select
                          value={scheduleType}
                          onChange={(e) => setScheduleType(e.target.value as 'text' | 'image' | 'audio' | 'document')}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="text">Texto</option>
                          <option value="image">Imagem</option>
                          <option value="audio">Áudio</option>
                          <option value="document">Documento</option>
                        </select>
                      </div>
                      {scheduleType === 'text' ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensagem</label>
                          <textarea
                            value={scheduleContent}
                            onChange={(e) => setScheduleContent(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            placeholder="Digite o texto..."
                          />
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Arquivo</label>
                            <input
                              type="file"
                              accept={scheduleType === 'image' ? 'image/*' : scheduleType === 'audio' ? 'audio/*,.mp3,.m4a,.ogg,.wav,.aac' : '.pdf,.doc,.docx,.xls,.xlsx'}
                              className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-primary-100 file:text-primary-700 dark:file:bg-primary-900/40 dark:file:text-primary-300"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setScheduleUploading(true);
                                setScheduleUploadedFile(null);
                                try {
                                  const { url } = await uploadService.uploadFile(file);
                                  setScheduleMediaUrl(url);
                                  setScheduleUploadedFile(file.name);
                                } catch (err: any) {
                                  toast.error(err.response?.data?.message || 'Erro ao enviar arquivo.');
                                } finally {
                                  setScheduleUploading(false);
                                  e.target.value = '';
                                }
                              }}
                              disabled={scheduleUploading}
                            />
                            {scheduleUploading && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Loader2 className="animate-spin" size={12} /> Enviando...</p>}
                            {scheduleUploadedFile && <p className="text-xs text-green-600 dark:text-green-400 mt-1">{scheduleUploadedFile}</p>}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ou URL da mídia</label>
                            <input
                              type="url"
                              value={scheduleMediaUrl}
                              onChange={(e) => { setScheduleMediaUrl(e.target.value); setScheduleUploadedFile(null); }}
                              placeholder="https://..."
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Legenda (opcional)</label>
                            <input
                              type="text"
                              value={scheduleContent}
                              onChange={(e) => setScheduleContent(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              placeholder="Legenda"
                            />
                          </div>
                        </>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data (horário local)</label>
                          <input
                            type="date"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            required
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hora (horário local)</label>
                          <input
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            required
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => setShowScheduleModal(false)}
                          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={scheduleSaving}
                          className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                        >
                          {scheduleSaving ? 'Agendando…' : 'Agendar'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
