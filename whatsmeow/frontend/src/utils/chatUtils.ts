import { ChatItem, MessageItem } from '../types';

export function parseJidToNumber(remoteJid: string): string {
  if (!remoteJid) return '';
  const parts = remoteJid.split('@');
  return parts[0] || remoteJid;
}

export function getChatDisplayName(chat: ChatItem): string {
  const name = typeof chat.name === 'string' ? chat.name.trim() : '';
  if (name) return name;
  const num = parseJidToNumber(chat.remote_jid || '');
  if (num) return num;
  return chat.remote_jid || 'Contato';
}

export function getAvatarLetter(chat: ChatItem): string {
  const name = getChatDisplayName(chat);
  return name.charAt(0).toUpperCase() || '?';
}

export function sortChatsByLastMessage(chats: ChatItem[]): ChatItem[] {
  return [...chats].sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });
}

export function mergeMessages(existing: MessageItem[], incoming: MessageItem[]): MessageItem[] {
  const map = new Map<string, MessageItem>();
  existing.forEach((m) => map.set(m.wa_message_id, m));
  incoming.forEach((m) => {
    const prev = map.get(m.wa_message_id);
    if (!prev) {
      map.set(m.wa_message_id, m);
    } else {
      map.set(m.wa_message_id, { ...prev, ...m });
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    return da - db;
  });
}

export function mergeMessagesForChat(chatId: string, existing: MessageItem[], incoming: MessageItem[]): MessageItem[] {
  const merged = mergeMessages(existing, incoming);
  return merged.filter((m) => m.chat_id === chatId || !m.chat_id);
}
