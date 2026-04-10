import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Columns, MessageCircle, RefreshCw, Loader2, GripVertical } from 'lucide-react';
import { instanceService, kanbanService, tagService } from '../services/api';
import { toast } from 'react-hot-toast';

const DRAG_KEY = 'application/x-kanban-chat';

interface KanbanChat {
  id: string;
  instance_id: string;
  remote_jid: string;
  name: string;
  last_message_preview?: string;
  last_message_at?: string;
  status?: string;
}

interface KanbanColumn {
  tag: { id: string; name: string; color?: string; sort_order?: number };
  chats: KanbanChat[];
}

export function Kanban() {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<{ id: string; instanceName?: string }[]>([]);
  const [instanceId, setInstanceId] = useState<string>('');
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [draggingChat, setDraggingChat] = useState<{ chatId: string; tagId: string } | null>(null);
  const [dropTargetTagId, setDropTargetTagId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await instanceService.list();
        const list = Array.isArray(data) ? data : [];
        const items = list.map((item: any) => ({
          id: item.instance?.id || item.instanceName || item.id || String(item),
          instanceName: item.instanceName || item.instance?.displayName || item.instance?.id || item.id,
        }));
        if (!cancelled && items.length > 0) {
          setInstances(items);
          if (!instanceId) setInstanceId(items[0].id);
        }
      } catch (e) {
        if (!cancelled) toast.error('Erro ao carregar instâncias');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!instanceId) {
      setColumns([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoadingColumns(true);
    kanbanService
      .getColumns(instanceId)
      .then((data) => {
        if (!cancelled) setColumns(Array.isArray(data) ? data : []);
      })
      .catch((e: any) => {
        if (!cancelled) {
          toast.error(e.response?.data?.message || 'Erro ao carregar Kanban');
          setColumns([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingColumns(false);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [instanceId]);

  const handleRefresh = () => {
    if (!instanceId) return;
    setLoadingColumns(true);
    kanbanService
      .getColumns(instanceId)
      .then((data) => setColumns(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Erro ao atualizar'))
      .finally(() => setLoadingColumns(false));
  };

  const openChat = (chat: KanbanChat) => {
    if (isDraggingRef.current || didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    navigate('/chat', { state: { instanceId: chat.instance_id, chatId: chat.id } });
  };

  const handleDragStart = (e: React.DragEvent, chat: KanbanChat, sourceTagId: string) => {
    isDraggingRef.current = true;
    didDragRef.current = true;
    setDraggingChat({ chatId: chat.id, tagId: sourceTagId });
    e.dataTransfer.setData(DRAG_KEY, JSON.stringify({ chat, sourceTagId }));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setDragImage(e.currentTarget as HTMLElement, 0, 0);
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
    setDraggingChat(null);
    setDropTargetTagId(null);
    setTimeout(() => { didDragRef.current = false; }, 0);
  };

  const handleDragOver = (e: React.DragEvent, tagId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetTagId(tagId);
  };

  const handleDragLeave = () => {
    setDropTargetTagId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetTagId: string) => {
    e.preventDefault();
    setDropTargetTagId(null);
    const raw = e.dataTransfer.getData(DRAG_KEY);
    if (!raw || !instanceId) return;
    let payload: { chat: KanbanChat; sourceTagId: string };
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    const { chat, sourceTagId } = payload;
    if (sourceTagId === targetTagId) return;
    setDraggingChat(null);
    isDraggingRef.current = false;

    const prevColumns = [...columns];
    setColumns((cols) => {
      const next = cols.map((c) => ({
        ...c,
        chats:
          c.tag.id === sourceTagId
            ? c.chats.filter((ch) => ch.id !== chat.id)
            : c.tag.id === targetTagId
              ? [...c.chats, chat]
              : c.chats,
      }));
      return next;
    });

    try {
      await tagService.removeFromChat(instanceId, chat.id, sourceTagId);
      await tagService.addToChat(instanceId, chat.id, targetTagId);
      toast.success('Tag alterada.');
    } catch (err: any) {
      setColumns(prevColumns);
      toast.error(err.response?.data?.message || 'Erro ao alterar tag.');
    }
  };

  const displayName = (chat: KanbanChat) => {
    const name = typeof chat.name === 'string' ? chat.name.trim() : '';
    if (name) return name;
    const num = (chat.remote_jid || '').split('@')[0] || '';
    return num || chat.remote_jid || 'Contato';
  };

  return (
    <div className="max-w-full mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Columns size={28} className="text-primary-600 dark:text-primary-400" />
            Kanban
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Colunas = tags com Kanban ativo (ordem). Cards = conversas com essa tag.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Instância</label>
          <select
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm min-w-[180px]"
          >
            <option value="">Selecione</option>
            {instances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.instanceName || i.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loadingColumns || !instanceId}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw size={18} className={loadingColumns ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading || loadingColumns ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-primary-600" size={40} />
        </div>
      ) : !instanceId ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-8 text-center text-gray-600 dark:text-gray-400">
          Selecione uma instância para ver o Kanban.
        </div>
      ) : columns.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-8 text-center text-gray-600 dark:text-gray-400">
          Nenhuma tag com Kanban ativo. Ative &quot;Exibir no Kanban&quot; nas tags em Admin → Tags.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
          {columns.map((col) => (
            <div
              key={col.tag.id}
              className={`flex-shrink-0 w-72 rounded-xl border overflow-hidden flex flex-col transition-colors ${
                dropTargetTagId === col.tag.id
                  ? 'border-primary-500 dark:border-primary-400 bg-primary-50/50 dark:bg-primary-900/20 ring-2 ring-primary-200 dark:ring-primary-800'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div
                className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: col.tag.color && /^#[0-9A-Fa-f]{6}$/.test(col.tag.color) ? col.tag.color : undefined,
                }}
              >
                <span className="font-semibold text-gray-900 dark:text-white">{col.tag.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                  {col.chats.length}
                </span>
              </div>
              <div
                className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]"
                onDragOver={(e) => handleDragOver(e, col.tag.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.tag.id)}
              >
                {col.chats.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                    {dropTargetTagId === col.tag.id ? 'Solte aqui' : 'Nenhuma conversa'}
                  </p>
                ) : (
                  col.chats.map((chat) => {
                    const isDraggingThis = draggingChat?.chatId === chat.id && draggingChat?.tagId === col.tag.id;
                    return (
                      <div
                        key={chat.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, chat, col.tag.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => openChat(chat)}
                        className={`w-full text-left p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-colors group ${
                          isDraggingThis
                            ? 'opacity-50 border-primary-300 dark:border-primary-600'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-200 dark:hover:border-primary-800'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical size={16} className="flex-shrink-0 text-gray-400 group-hover:text-primary-500 mt-0.5" />
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 text-sm font-medium">
                            {(displayName(chat) || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400">
                              {displayName(chat)}
                            </p>
                            {chat.last_message_preview && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                {chat.last_message_preview}
                              </p>
                            )}
                          </div>
                          <MessageCircle size={14} className="flex-shrink-0 text-gray-400 group-hover:text-primary-500" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
