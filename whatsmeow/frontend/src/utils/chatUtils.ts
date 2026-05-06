import { ChatItem, MessageItem } from '../types';

export function parseJidToNumber(remoteJid: string): string {
  if (!remoteJid) return '';
  const parts = remoteJid.split('@');
  return parts[0] || remoteJid;
}

export function formatBrazilianPhone(num: string): string {
  const digits = num.replace(/\D/g, '');
  // Remove DDI 55 if present and remaining digits look like a Brazilian number
  const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return num;
}

export function getChatDisplayName(chat: ChatItem): string {
  const name = typeof chat.name === 'string' ? chat.name.trim() : '';
  if (name) return name;
  const jid = chat.remote_jid || '';
  if (jid.endsWith('@g.us')) return 'Grupo';
  const num = parseJidToNumber(jid);
  if (num) return formatBrazilianPhone(num);
  return 'Contato';
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
