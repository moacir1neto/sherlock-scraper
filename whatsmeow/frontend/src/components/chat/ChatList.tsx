import { Search, Loader2, Tag, Layout } from 'lucide-react';
import { ChatItem } from '../../types';
import { getChatDisplayName, getAvatarLetter } from '../../utils/chatUtils';
import { motion } from 'framer-motion';

interface ChatListProps {
  chats: ChatItem[];
  activeQueue: 'aguardando' | 'atendendo' | 'finalizado';
  selectedChat: ChatItem | null;
  onSelectChat: (chat: ChatItem) => void;
  onQueueChange: (queue: 'aguardando' | 'atendendo' | 'finalizado') => void;
  loading: boolean;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  allTags: any[];
  sectors: any[];
  activeTagFilterId: string | null;
  onTagFilterChange: (id: string | null) => void;
  activeSectorFilterId: string | null;
  onSectorFilterChange: (id: string | null) => void;
  chatTagSummary: Record<string, Array<{ id: string; name: string; color?: string }>>;
}

export function ChatList({
  chats,
  activeQueue,
  selectedChat,
  onSelectChat,
  onQueueChange,
  loading,
  searchTerm,
  onSearchChange,
  allTags,
  sectors,
  activeTagFilterId,
  onTagFilterChange,
  activeSectorFilterId,
  onSectorFilterChange,
  chatTagSummary,
}: ChatListProps) {
  const filteredChats = chats.filter((c) => {
    const name = getChatDisplayName(c).toLowerCase();
    const jid = c.remote_jid.toLowerCase();
    const search = searchTerm.toLowerCase();
    return name.includes(search) || jid.includes(search);
  });

  return (
    <aside className="w-80 flex flex-col bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-r border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
      {/* Search & Tabs */}
      <div className="p-4 space-y-4">
        <div className="relative group">
          <Search className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Buscar conversa..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200/60 dark:border-gray-700/60 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl text-sm transition-all outline-none"
          />
        </div>

        <div className="flex p-1 bg-gray-100/50 dark:bg-gray-900/50 rounded-xl border border-gray-200/20">
          {(['aguardando', 'atendendo', 'finalizado'] as const).map((queue) => (
            <button
              key={queue}
              onClick={() => onQueueChange(queue)}
              className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                activeQueue === queue
                  ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {queue}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <select
              value={activeTagFilterId || ''}
              onChange={(e) => onTagFilterChange(e.target.value || null)}
              className="w-full pl-8 pr-2 py-1.5 bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-700/50 rounded-xl text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
            >
              <option value="">Todas Tags</option>
              {allTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <Tag className="absolute left-2.5 top-2 text-emerald-400" size={12} />
          </div>
          <div className="relative">
            <select
              value={activeSectorFilterId || ''}
              onChange={(e) => onSectorFilterChange(e.target.value || null)}
              className="w-full pl-8 pr-2 py-1.5 bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-700/50 rounded-xl text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
            >
              <option value="">Todos Setores</option>
              {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Layout className="absolute left-2.5 top-2 text-emerald-400" size={12} />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="animate-spin text-emerald-500" size={24} />
            <span className="text-xs text-gray-400 font-medium">Carregando conversas...</span>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400 font-medium">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          filteredChats.map((chat) => (
            <motion.button
              key={chat.id}
              whileHover={{ scale: 1.01, x: 4 }}
              transition={{ duration: 0.2 }}
              onClick={() => onSelectChat(chat)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 group relative ${
                selectedChat?.id === chat.id
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-2 border-emerald-600 shadow-sm'
                  : 'hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 border-l-2 border-transparent'
              }`}
            >
              <div className="relative shrink-0">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg border-2 ${
                  selectedChat?.id === chat.id ? 'bg-white dark:bg-gray-800 border-emerald-500/20 text-emerald-600' : 'bg-emerald-100 dark:bg-emerald-900/40 border-transparent text-emerald-600 dark:text-emerald-400'
                }`}>
                  {getAvatarLetter(chat)}
                </div>
                {/* Badge placeholder if unread were available */}
                {/* <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 shadow-sm">3</div> */}
              </div>

              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className={`text-sm font-bold truncate ${selectedChat?.id === chat.id ? 'text-emerald-900 dark:text-emerald-100' : 'text-gray-900 dark:text-gray-100'}`}>
                    {getChatDisplayName(chat)}
                  </h3>
                  {chat.last_message_at && (
                    <span className="text-[10px] text-gray-400 font-bold uppercase whitespace-nowrap">
                      {new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate line-clamp-1 font-medium">
                  {chat.last_message_preview || 'Inicie uma conversa'}
                </p>
                
                {/* Tags summary */}
                <div className="flex gap-1 mt-1.5 overflow-hidden">
                  {chatTagSummary[chat.id]?.map((tag: { id: string; name: string; color?: string }) => (
                    <div
                      key={tag.id}
                      className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: tag.color || '#a855f7' }}
                      title={tag.name}
                    />
                  ))}
                </div>
              </div>
            </motion.button>
          ))
        )}
      </div>
    </aside>
  );
}
