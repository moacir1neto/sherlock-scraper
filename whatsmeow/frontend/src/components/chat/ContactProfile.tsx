import { Tag as TagIcon, Layout, CheckCircle, Brain, PauseCircle, Calendar, X } from 'lucide-react';
import { ChatItem } from '../../types';
import { ChatAvatar } from './ChatAvatar';
import { getChatDisplayName, getAvatarLetter, parseJidToNumber } from '../../utils/chatUtils';
import { motion } from 'framer-motion';

interface ContactProfileProps {
  chat: ChatItem | null;
  chatTags: Array<{ id: string; name: string; color?: string }>;
  allTags: Array<{ id: string; name: string; color?: string }>;
  sectors: Array<{ id: string; name: string }>;
  instanceId: string;
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onChangeSector: (sectorId: string | null) => void;
  onFinish: () => void;
  onResumeAgent: () => void;
  onPauseAgent: () => void;
  onScheduleMessage: () => void;
  changingStatus: boolean;
  changingSector: boolean;
}

export function ContactProfile({
  chat,
  chatTags,
  allTags,
  sectors,
  instanceId,
  onAddTag,
  onRemoveTag,
  onChangeSector,
  onFinish,
  onResumeAgent,
  onPauseAgent,
  onScheduleMessage,
  changingStatus,
  changingSector,
}: ContactProfileProps) {
  if (!chat) return null;

  return (
    <aside className="w-80 flex flex-col bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-l border-gray-200/60 dark:border-gray-700/60 overflow-y-auto custom-scrollbar">
      <div className="p-6 flex flex-col items-center text-center border-b border-gray-100 dark:border-gray-700/50">
        <div className="relative p-1 rounded-full bg-gradient-to-tr from-emerald-600 to-green-600 shadow-lg shadow-emerald-500/20">
          <div className="rounded-full border-2 border-white dark:border-gray-800 overflow-hidden">
            <ChatAvatar
              instanceId={instanceId}
              remoteJid={chat.remote_jid}
              displayLetter={getAvatarLetter(chat)}
              size="lg"
            />
          </div>
        </div>
        <h2 className="mt-4 text-base font-black text-gray-900 dark:text-white leading-tight">
          {getChatDisplayName(chat)}
        </h2>
        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 uppercase tracking-widest">
          {parseJidToNumber(chat.remote_jid)}
        </p>
      </div>

      <div className="p-6 space-y-8">
        {/* Actions */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block">Ações do Chat</label>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={onFinish}
              disabled={changingStatus || chat.status === 'finalizado'}
              className="flex items-center gap-3 w-full p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-all group disabled:opacity-50"
            >
              <div className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm group-hover:scale-110 transition-transform">
                <CheckCircle size={18} className="text-emerald-600" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Finalizar Chat</span>
            </button>

            {chat.ai_paused ? (
              <button
                onClick={onResumeAgent}
                aria-label="Retomar agente de IA neste chat"
                className="flex items-center gap-3 w-full p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-all group"
              >
                <div className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm group-hover:scale-110 transition-transform">
                  <Brain size={18} className="text-emerald-600" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Retomar Agente IA</span>
              </button>
            ) : (
              <button
                onClick={onPauseAgent}
                aria-label="Assumir controle do chat e pausar IA"
                className="flex items-center gap-3 w-full p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-all group"
              >
                <div className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm group-hover:scale-110 transition-transform">
                  <PauseCircle size={18} className="text-amber-600" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Assumir Chat</span>
              </button>
            )}

            <button
              onClick={onScheduleMessage}
              className="flex items-center gap-3 w-full p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-all group"
            >
              <div className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm group-hover:scale-110 transition-transform">
                <Calendar size={18} className="text-emerald-600" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Agendar Mensagem</span>
            </button>
          </div>
        </div>

        {/* Sector */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layout size={14} className="text-emerald-500" />
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Setor Responsável</label>
          </div>
          <select
            value={chat.sector_id || ''}
            onChange={(e) => onChangeSector(e.target.value || null)}
            disabled={changingSector}
            className="w-full p-3 bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100/50 dark:border-emerald-700/50 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
          >
            <option value="">Sem Setor</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TagIcon size={14} className="text-emerald-500" />
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Tags do Contato</label>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {chatTags.map((tag) => (
              <motion.div
                key={tag.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm group"
              >
                <span>{tag.name}</span>
                <button
                  onClick={() => onRemoveTag(tag.id)}
                  className="p-0.5 hover:bg-emerald-200 rounded-full transition-colors"
                >
                  <X size={10} />
                </button>
              </motion.div>
            ))}
          </div>

          <div className="relative">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onAddTag(e.target.value);
                  e.target.value = '';
                }
              }}
              className="w-full p-3 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-400 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer"
            >
              <option value="">Adicionar Tag...</option>
              {allTags
                .filter((t) => !chatTags.some((ct) => ct.id === t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
          </div>
        </div>
      </div>
    </aside>
  );
}
