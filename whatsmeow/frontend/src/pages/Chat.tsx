import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { instanceService, chatService, messageService, tagService, sectorService, quickRepliesService, flowService } from '../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { getNotificationSettings } from '../utils/notificationSettings';
import { ChatItem, MessageItem, ChatMessagesCacheEntry } from '../types';
import { sortChatsByLastMessage, parseJidToNumber, mergeMessages, mergeMessagesForChat } from '../utils/chatUtils';
import { ChatList } from '../components/chat/ChatList';
import { MessageThread } from '../components/chat/MessageThread';
import { ContactProfile } from '../components/chat/ContactProfile';
import { ScheduleModal } from '../components/chat/ScheduleModal';
import { motion, AnimatePresence } from 'framer-motion';

const MESSAGES_PAGE_SIZE = 30;

export function Chat() {
  useAuth();
  const location = useLocation();
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
  const [chatTagSummary, setChatTagSummary] = useState<Record<string, Array<{ id: string; name: string; color?: string }>>>({});
  const [activeTagFilterId, setActiveTagFilterId] = useState<string | null>(null);
  const [activeSectorFilterId, setActiveSectorFilterId] = useState<string | null>(null);
  const [quickRepliesList, setQuickRepliesList] = useState<Array<{ id: string; command: string; message: string }>>([]);
  const [flowsList, setFlowsList] = useState<Array<{ id: string; command?: string; name: string }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(true);

  const selectedChatRef = useRef<ChatItem | null>(null);
  const instanceIdRef = useRef<string>('');
  const chatsRef = useRef<ChatItem[]>([]);
  const scrollAfterSendRef = useRef(false);
  const scrollWhenOpeningRef = useRef(false);
  const pendingQuotedRef = useRef<{ waMessageId: string; preview: string } | null>(null);
  const notifications = useNotifications();
  const addNotificationRef = useRef(notifications?.addNotification);
  addNotificationRef.current = notifications?.addNotification;

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
                    messages: cur.messages.map((m: MessageItem) =>
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

  const loadMessages = useCallback(async (chatId: string, beforeId?: string) => {
    if (!instanceId) return;
    setLoadingMessages(true);
    try {
      const data = await chatService.getMessages(instanceId, chatId, { limit: MESSAGES_PAGE_SIZE, before_id: beforeId });
      const list = Array.isArray(data) ? data : [];
      const reversed = list.slice().reverse() as MessageItem[];
      const hasMore = list.length >= MESSAGES_PAGE_SIZE;

      if (beforeId) {
        setMessagesByChatId((prev) => {
          const cur = prev[chatId];
          if (!cur) return prev;
          const merged = mergeMessagesForChat(chatId, cur.messages, reversed);
          return { ...prev, [chatId]: { ...cur, messages: merged, hasMore } };
        });
      } else {
        setMessagesByChatId((prev) => ({
          ...prev,
          [chatId]: { messages: mergeMessagesForChat(chatId, [], reversed), hasMore, loading: false },
        }));
      }
    } catch (e) {
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoadingMessages(false);
    }
  }, [instanceId]);

  useEffect(() => {
    if (!selectedChat) return;
    scrollWhenOpeningRef.current = true;
    loadMessages(selectedChat.id);
  }, [selectedChat?.id, loadMessages]);

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
          toast.error('Erro ao carregar conversas.');
        }
      } finally {
        if (!cancelled) setLoadingChats(false);
      }
    })();
    return () => { cancelled = true; };
  }, [instanceId]);

  useEffect(() => {
    if (!instanceId) {
      setSectors([]);
      return;
    }
    sectorService.list().then((list) => setSectors(Array.isArray(list) ? list : [])).catch(() => setSectors([]));
  }, [instanceId]);

  useEffect(() => {
    if (!instanceId) return;
    tagService.list().then((list) => setAllTags(Array.isArray(list) ? list : [])).catch(() => setAllTags([]));
  }, [instanceId]);

  useEffect(() => {
    if (!instanceId || !selectedChat?.id) {
      setChatTags([]);
      return;
    }
    tagService.listByChat(instanceId, selectedChat.id).then((list) => {
      const arr = Array.isArray(list) ? list : [];
      setChatTags(arr);
      if (selectedChat?.id) {
        setChatTagSummary((prev) => ({ ...prev, [selectedChat.id]: arr }));
      }
    }).catch(() => setChatTags([]));
  }, [instanceId, selectedChat?.id]);

  useEffect(() => {
    quickRepliesService.list().then((list) => setQuickRepliesList(Array.isArray(list) ? list : [])).catch(() => setQuickRepliesList([]));
    flowService.list().then((list) => {
      const arr = Array.isArray(list) ? list : [];
      setFlowsList(arr.map((f) => ({ id: f.id, command: f.command, name: f.name })));
    }).catch(() => setFlowsList([]));
  }, []);

  const handleSend = async () => {
    if (!instanceId || !selectedChat || !inputText.trim()) return;
    const number = parseJidToNumber(selectedChat.remote_jid);
    if (!number) { toast.error('Número inválido'); return; }
    setSending(true);
    const sentPreview = inputText.trim().slice(0, 50);
    const sentAt = new Date().toISOString();
    const quoted = replyToMessage ? {
      key: { id: replyToMessage.wa_message_id, remoteJid: selectedChat.remote_jid, fromMe: replyToMessage.from_me },
      message: { conversation: replyToMessage.content || '' }
    } : undefined;

    try {
      const res = await messageService.sendText(instanceId, number, inputText.trim(), quoted);
      setInputText('');
      const quotedPreview = replyToMessage?.content?.slice(0, 200) ?? '';
      setReplyToMessage(null);
      if (replyToMessage && quotedPreview && res?.key?.id) {
        pendingQuotedRef.current = { waMessageId: res.key.id, preview: quotedPreview };
      }
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
      toast.error(e.response?.data?.message || 'Erro ao enviar');
    } finally {
      setSending(false);
    }
  };

  const handleAttend = async (chat: ChatItem) => {
    if (!instanceId) return;
    setChangingStatus(true);
    try {
      await fetch(`/v1/instance/${instanceId}/chats/${chat.id}/attend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, status: 'atendendo' } : c)));
      setSelectedChat((prev) => (prev && prev.id === chat.id ? { ...prev, status: 'atendendo' } : prev));
    } catch {
      toast.error('Erro ao mudar status');
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
      setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, status: 'finalizado' } : c)));
      setSelectedChat((prev) => (prev && prev.id === chat.id ? { ...prev, status: 'finalizado' } : prev));
    } catch {
      toast.error('Erro ao finalizar');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleAddTag = async (tagId: string) => {
    if (!instanceId || !selectedChat?.id) return;
    try {
      await tagService.addToChat(instanceId, selectedChat.id, tagId);
      const tag = allTags.find(t => t.id === tagId);
      if (tag && selectedChat?.id) {
        const chatId = selectedChat.id;
        setChatTags(prev => [...prev, tag]);
        setChatTagSummary(prev => ({
          ...prev,
          [chatId]: [...(prev[chatId] || []), tag]
        }));
      }
      toast.success('Tag adicionada');
    } catch {
      toast.error('Erro ao adicionar tag');
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!instanceId || !selectedChat?.id) return;
    try {
      await tagService.removeFromChat(instanceId, selectedChat.id, tagId);
      const chatId = selectedChat.id;
      setChatTags(prev => prev.filter(t => t.id !== tagId));
      setChatTagSummary(prev => ({
        ...prev,
        [chatId]: (prev[chatId] || []).filter(t => t.id !== tagId)
      }));
      toast.success('Tag removida');
    } catch {
      toast.error('Erro ao remover tag');
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
      setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, sector_id: sectorId || undefined } : c)));
      if (selectedChat?.id === chat.id) setSelectedChat({ ...chat, sector_id: sectorId || undefined });
    } catch {
      toast.error('Erro ao transferir setor');
    } finally {
      setChangingSector(false);
    }
  };

  const handleResumeAgent = async (chat: ChatItem) => {
    if (!instanceId) return;
    try {
      await fetch(`/v1/instance/${instanceId}/chats/${chat.id}/resume-agent`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, ai_paused: false } : c)));
      setSelectedChat((prev) => (prev && prev.id === chat.id ? { ...prev, ai_paused: false } : prev));
      toast.success('Agente de IA retomado');
    } catch {
      toast.error('Erro ao retomar agente de IA');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      {/* Header Orquestrador */}
      <div className="flex items-center gap-3 px-6 py-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200/60 dark:border-gray-700/60 z-20">
        <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/20 flex-shrink-0">
          <MessageCircle size={22} />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-black text-gray-900 dark:text-white leading-tight">Neural Chat</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            {wsConnected ? 'Conectado em tempo real' : 'Reconectando...'}
          </p>
        </div>
        
        <select
          value={instanceId}
          onChange={(e) => setInstanceId(e.target.value)}
          disabled={loadingInstances}
          className="px-4 py-2 rounded-xl bg-gray-100/50 dark:bg-gray-700/50 border border-gray-200/50 dark:border-gray-600/50 text-gray-900 dark:text-white text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500/20 transition-all cursor-pointer appearance-none pr-8 relative"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '14px' }}
        >
          <option value="">Selecione a instância</option>
          {instances.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.instanceName || inst.id}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ChatList
          chats={chats
          .filter(c => c.remote_jid?.endsWith('@s.whatsapp.net'))
          .filter((c) => {
            const s = c.status ?? 'aguardando';
            if (activeQueue === 'aguardando') return s === 'aguardando' || s === 'pending' || s === 'open';
            if (activeQueue === 'atendendo') return s === 'atendendo' || s === 'active';
            if (activeQueue === 'finalizado') return s === 'finalizado' || s === 'closed' || s === 'finished' || s === 'close';
            return true;
          })}
          activeQueue={activeQueue}
          selectedChat={selectedChat}
          onSelectChat={setSelectedChat}
          onQueueChange={setActiveQueue}
          loading={loadingChats}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          allTags={allTags}
          sectors={sectors}
          activeTagFilterId={activeTagFilterId}
          onTagFilterChange={setActiveTagFilterId}
          activeSectorFilterId={activeSectorFilterId}
          onSectorFilterChange={setActiveSectorFilterId}
          chatTagSummary={chatTagSummary}
        />

        <main className="flex-1 flex min-w-0">
          <MessageThread
            selectedChat={selectedChat}
            messages={messages}
            loading={loadingMessages}
            hasMore={hasMoreOlder}
            onLoadMore={() => loadMessages(selectedChat!.id, messages[0]?.id)}
            onSendMessage={handleSend}
            onReact={async (m, emoji) => {
              if (!instanceId || !selectedChat || !m.wa_message_id) return;
              try {
                await messageService.sendReaction(instanceId, { remoteJid: selectedChat.remote_jid, id: m.wa_message_id, fromMe: m.from_me }, emoji);
                setReactions((r) => ({ ...r, [m.wa_message_id]: emoji }));
              } catch { toast.error('Erro ao reagir'); }
            }}
            onReply={setReplyToMessage}
            onRevoke={setRevokeTarget}
            onEdit={setEditTarget}
            inputText={inputText}
            onInputTextChange={setInputText}
            onAttend={selectedChat ? () => handleAttend(selectedChat) : undefined}
            sending={sending}
            replyToMessage={replyToMessage}
            onCancelReply={() => setReplyToMessage(null)}
            quickReplies={quickRepliesList}
            flows={flowsList}
            reactions={reactions}
            instanceId={instanceId}
            isProfileOpen={isProfileOpen}
            onToggleProfile={() => setIsProfileOpen(!isProfileOpen)}
          />

          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, type: 'spring', damping: 25, stiffness: 200 }}
                className="overflow-hidden border-l border-gray-200/60 dark:border-gray-700/60 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md"
              >
                <div className="w-[320px]">
                  <ContactProfile
                    chat={selectedChat}
                    chatTags={chatTags}
                    allTags={allTags}
                    sectors={sectors}
                    instanceId={instanceId}
                    onAddTag={handleAddTag}
                    onRemoveTag={handleRemoveTag}
                    onChangeSector={(sid) => handleChangeSector(selectedChat!, sid)}
                    onFinish={() => setShowFinishModal(true)}
                    onResumeAgent={() => handleResumeAgent(selectedChat!)}
                    onScheduleMessage={() => setShowScheduleModal(true)}
                    changingStatus={changingStatus}
                    changingSector={changingSector}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Modals Transferred from Chat.tsx */}
      {revokeTarget && selectedChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">Apagar mensagem?</h3>
            <p className="text-sm text-gray-500 font-medium mb-6">Esta ação apagará a mensagem para todos os participantes.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRevokeTarget(null)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold uppercase text-gray-400">Cancelar</button>
              <button 
                onClick={async () => {
                  if (!selectedChat?.id || !revokeTarget) return;
                  const chatId = selectedChat.id;
                  setRevoking(true);
                  try {
                    await messageService.revokeMessage(instanceId, { remoteJid: selectedChat.remote_jid, id: revokeTarget.wa_message_id, fromMe: revokeTarget.from_me });
                    setMessagesByChatId((prev: Record<string, ChatMessagesCacheEntry>) => ({
                      ...prev,
                      [chatId]: { ...prev[chatId], messages: (prev[chatId]?.messages || []).filter((m: MessageItem) => m.id !== revokeTarget.id) }
                    }));
                    setRevokeTarget(null);
                    toast.success('Apagada');
                  } catch { toast.error('Erro ao apagar'); } finally { setRevoking(false); }
                }}
                disabled={revoking}
                className="px-6 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold uppercase shadow-lg shadow-rose-600/20"
              >
                {revoking ? 'Apagando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editTarget && selectedChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">Editar Mensagem</h3>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm min-h-[120px] outline-none focus:ring-2 focus:ring-primary-500/20"
              autoFocus
            />
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setEditTarget(null)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold uppercase text-gray-400">Cancelar</button>
              <button 
                onClick={async () => {
                  if (!selectedChat?.id || !editTarget) return;
                  const chatId = selectedChat.id;
                  setSavingEdit(true);
                  try {
                    await messageService.editMessage(instanceId, { remoteJid: selectedChat.remote_jid, id: editTarget.wa_message_id }, editText);
                    setMessagesByChatId((prev: Record<string, ChatMessagesCacheEntry>) => ({
                      ...prev,
                      [chatId]: { ...prev[chatId], messages: (prev[chatId]?.messages || []).map((m: MessageItem) => m.id === editTarget.id ? { ...m, content: editText } : m) }
                    }));
                    setEditTarget(null);
                    toast.success('Editada');
                  } catch { toast.error('Erro ao editar'); } finally { setSavingEdit(false); }
                }}
                disabled={savingEdit || !editText.trim()}
                className="px-6 py-2 rounded-xl bg-primary-600 text-white text-xs font-bold uppercase shadow-lg shadow-primary-600/20"
              >
                {savingEdit ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Finalizar */}
      {showFinishModal && selectedChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">Finalizar Atendimento?</h3>
            <p className="text-sm text-gray-500 font-medium mb-6">A conversa será movida para a fila de finalizados.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowFinishModal(false)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold uppercase text-gray-400">Voltar</button>
              <button 
                onClick={async () => {
                  await handleFinish(selectedChat);
                  setShowFinishModal(false);
                }}
                className="px-6 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold uppercase shadow-lg shadow-emerald-600/20"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {showScheduleModal && selectedChat && (
        <ScheduleModal
          chat={selectedChat}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </div>
  );
}
