import { useRef, useEffect, useMemo, useState } from 'react';
import { Send, Smile, Loader2, X, Zap, Cpu, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { MessageItem as MessageType, ChatItem } from '../../types';
import { MessageItem } from './MessageItem';
import { ChatAvatar } from './ChatAvatar';
import { getChatDisplayName, getAvatarLetter } from '../../utils/chatUtils';
import { motion, AnimatePresence } from 'framer-motion';

interface MessageThreadProps {
  selectedChat: ChatItem | null;
  messages: MessageType[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSendMessage: () => void;
  onReact: (msg: MessageType, emoji: string) => void;
  onReply: (msg: MessageType) => void;
  onRevoke: (msg: MessageType) => void;
  onEdit: (msg: MessageType) => void;
  inputText: string;
  onInputTextChange: (val: string) => void;
  onAttend?: () => void;
  sending: boolean;
  replyToMessage: MessageType | null;
  onCancelReply: () => void;
  quickReplies: Array<{ id: string; command: string; message: string }>;
  flows: Array<{ id: string; command?: string; name: string }>;
  reactions: Record<string, string>;
  instanceId: string;
  isProfileOpen?: boolean;
  onToggleProfile?: () => void;
}

export function MessageThread({
  selectedChat,
  messages,
  loading,
  hasMore,
  onLoadMore,
  onSendMessage,
  onReact,
  onReply,
  onRevoke,
  onEdit,
  inputText,
  onInputTextChange,
  onAttend,
  sending,
  replyToMessage,
  onCancelReply,
  quickReplies,
  flows,
  reactions,
  instanceId,
  isProfileOpen,
  onToggleProfile,
}: MessageThreadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const filteredQuickReplies = useMemo(() => {
    if (!inputText.startsWith('/')) return [];
    const search = inputText.slice(1).toLowerCase();
    return quickReplies.filter(q => q.command.toLowerCase().includes(search));
  }, [inputText, quickReplies]);

  const filteredFlows = useMemo(() => {
    if (!inputText.startsWith('\\')) return [];
    const search = inputText.slice(1).toLowerCase();
    return flows.filter(f => (f.command || '').toLowerCase().includes(search));
  }, [inputText, flows]);

  useEffect(() => { setHighlightIdx(0); }, [filteredQuickReplies.length, filteredFlows.length]);

  if (!selectedChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900/50">
        <div className="w-20 h-20 rounded-3xl bg-white dark:bg-gray-800 shadow-xl flex items-center justify-center mb-6 border border-gray-100 dark:border-gray-700">
          <Send className="text-primary-500/20" size={40} />
        </div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Seu Workspace WhatsMiau</h2>
        <p className="text-sm text-gray-400 font-medium max-w-xs text-center leading-relaxed">
          Selecione uma conversa ao lado para visualizar o histórico de mensagens e iniciar o atendimento.
        </p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex-1 flex flex-col min-w-0 bg-gray-50/50 dark:bg-gray-900/30"
    >
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200/60 dark:border-gray-700/60 z-10 shadow-sm rounded-t-2xl">
        <div className="flex items-center gap-3">
          <ChatAvatar
            instanceId={instanceId}
            remoteJid={selectedChat.remote_jid}
            displayLetter={getAvatarLetter(selectedChat)}
            size="md"
          />
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white leading-tight">
              {getChatDisplayName(selectedChat)}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ativo Agora</span>
            </div>
          </div>
        </div>

        <button
          onClick={onToggleProfile}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-emerald-500 transition-all cursor-pointer"
          aria-label={isProfileOpen ? "Ocultar painel de contato" : "Mostrar painel de contato"}
        >
          {isProfileOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
        </button>
      </header>

      {/* Messages */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar"
        role="log"
      >
        {hasMore && (
          <div className="flex justify-center mb-6">
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="px-4 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-emerald-500 transition-colors disabled:opacity-50"
            >
              {loading ? 'Carregando...' : 'Carregar mensagens anteriores'}
            </button>
          </div>
        )}

        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <MessageItem
                  msg={msg}
                  instanceId={instanceId}
                  chatId={selectedChat.id}
                  onReply={onReply}
                  onReact={onReact}
                  onRevoke={onRevoke}
                  onEdit={onEdit}
                  reactionEmoji={reactions[msg.wa_message_id]}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={endRef} />
        </div>
      </div>

      {/* Input Area */}
      <footer className="p-6 bg-transparent">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence>
            {replyToMessage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mb-2 p-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl flex items-center justify-between shadow-lg"
              >
                <div className="flex items-center gap-3 border-l-4 border-emerald-500 pl-3">
                  <div className="text-xs">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">Respondendo a {replyToMessage.from_me ? 'você' : 'contato'}</p>
                    <p className="text-gray-500 dark:text-gray-400 truncate max-w-md">{replyToMessage.content || '[Mídia]'}</p>
                  </div>
                </div>
                <button onClick={onCancelReply} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <X size={16} className="text-gray-400" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {selectedChat.status !== 'atendendo' && onAttend && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 bg-amber-50/80 dark:bg-amber-900/20 backdrop-blur-sm border border-amber-200/50 dark:border-amber-700/50 rounded-2xl flex items-center justify-between shadow-lg"
            >
              <div className="flex-1">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-widest mb-1">Aguardando Atendimento</p>
                <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70 font-medium">Você precisa iniciar o atendimento para enviar mensagens.</p>
              </div>
              <button
                onClick={onAttend}
                className="px-6 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:scale-105 transition-all"
              >
                Atender Agora
              </button>
            </motion.div>
          )}

          <div className="relative flex items-end gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-3 shadow-lg focus-within:border-emerald-500/50 transition-all">
            {/* Quick Replies Dropdown */}
            {filteredQuickReplies.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-2">
                  <Zap size={12} className="text-amber-500" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Respostas Rápidas</p>
                </div>
                <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                  {filteredQuickReplies.map((q, i) => (
                    <button
                      key={q.id}
                      onClick={() => { onInputTextChange(q.message); }}
                      className={`w-full text-left p-3 rounded-xl transition-colors group flex items-center justify-between ${i === highlightIdx ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 mb-0.5">/{q.command}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{q.message}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Flows Dropdown */}
            {filteredFlows.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-2">
                  <Cpu size={12} className="text-emerald-500" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fluxos de IA</p>
                </div>
                <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                  {filteredFlows.map((f, i) => (
                    <button
                      key={f.id}
                      onClick={() => { onInputTextChange(`\\${f.command || ''}`); onSendMessage(); }}
                      className={`w-full text-left p-3 rounded-xl transition-colors group flex items-center justify-between ${i === highlightIdx ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 mb-0.5">\{f.command || 'fluxo'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{f.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors rounded-xl">
              <Smile size={22} />
            </button>
            
            <textarea
              value={inputText}
              onChange={(e) => onInputTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSendMessage();
                }
              }}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 resize-none max-h-32 custom-scrollbar text-gray-900 dark:text-white"
              rows={1}
            />

            <button
              onClick={onSendMessage}
              disabled={sending || !inputText.trim()}
              className="bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl px-4 py-2 hover:shadow-lg transition-all shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:scale-100"
              aria-label="Enviar mensagem"
            >
              {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
          
          <p className="mt-3 text-[10px] text-center font-black text-gray-400 uppercase tracking-widest opacity-50">
            Use <span className="text-emerald-500">/</span> para respostas rápidas e <span className="text-emerald-500">\</span> para fluxos de IA
          </p>
        </div>
      </footer>
    </motion.div>
  );
}
