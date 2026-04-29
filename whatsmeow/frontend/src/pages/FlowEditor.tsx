import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Trash2, Play, Clock, MessageSquare, Image, Mic, Type, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { flowService } from '../services/api';
import { toast } from 'react-hot-toast';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

export interface FlowStep {
  id: string;
  componentType: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
}

export interface FlowDefinition {
  properties: Record<string, unknown>;
  sequence: FlowStep[];
}

const DEFAULT_DEFINITION: FlowDefinition = { properties: {}, sequence: [] };

const STEP_TYPES: { type: string; label: string; defaultName: string; icon: React.ReactNode }[] = [
  { type: 'trigger', label: 'Início', defaultName: 'Início', icon: <Play size={14} /> },
  { type: 'delay', label: 'Atraso', defaultName: 'Atraso', icon: <Clock size={14} /> },
  { type: 'sendText', label: 'Enviar texto', defaultName: 'Enviar texto', icon: <MessageSquare size={14} /> },
  { type: 'sendMedia', label: 'Enviar mídia', defaultName: 'Enviar mídia', icon: <Image size={14} /> },
  { type: 'sendAudio', label: 'Enviar áudio', defaultName: 'Enviar áudio', icon: <Mic size={14} /> },
  { type: 'typing', label: 'Mostrar digitando', defaultName: 'Digitando', icon: <Type size={14} /> },
];

function generateId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 56;
const VERTICAL_GAP = 80;

interface FlowNode {
  step: FlowStep;
  x: number;
  y: number;
}

interface FlowEdge {
  id: string;
  sourceId: string;
  targetId: string;
}

function definitionToNodesAndEdges(definition: FlowDefinition): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const seq = definition.sequence ?? [];
  const nodes: FlowNode[] = seq.map((step, i) => ({
    step,
    x: 0,
    y: i * (NODE_HEIGHT + VERTICAL_GAP),
  }));
  const edges: FlowEdge[] = [];
  for (let i = 0; i < seq.length - 1; i++) {
    edges.push({ id: `e-${seq[i].id}-${seq[i + 1].id}`, sourceId: seq[i].id, targetId: seq[i + 1].id });
  }
  return { nodes, edges };
}

function nodesAndEdgesToDefinition(nodes: FlowNode[], edges: FlowEdge[]): FlowDefinition {
  if (nodes.length === 0) return { properties: {}, sequence: [] };
  const targetIds = new Set(edges.map((e) => e.targetId));
  const head = nodes.find((n) => !targetIds.has(n.step.id));
  const order: FlowNode[] = [];
  if (head) {
    const byId = new Map(nodes.map((n) => [n.step.id, n]));
    let current: FlowNode | undefined = head;
    while (current) {
      order.push(current);
      const out = edges.find((e) => e.sourceId === current!.step.id);
      current = out ? byId.get(out.targetId) : undefined;
    }
  }
  const remaining = nodes.filter((n) => !order.some((o) => o.step.id === n.step.id));
  const sequence = [...order, ...remaining].map((n) => n.step);
  return { properties: {}, sequence };
}

interface FlowEditorProps {
  flowId: string;
}

export function FlowEditor({ flowId }: FlowEditorProps) {
  const navigate = useNavigate();
  const [flow, setFlow] = useState<{ id: string; name: string; command?: string; definition?: unknown } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ nodeIndex: number; startX: number; startY: number; startNodeX: number; startNodeY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const saveDefinition = useCallback(
    (def: FlowDefinition) => {
      if (!flow?.id || saving) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await flowService.update(flow.id, { name: flow.name, command: flow.command || '', definition: def });
        } catch (e: unknown) {
          const err = e as { response?: { data?: { message?: string } } };
          toast.error(err.response?.data?.message || 'Erro ao salvar');
        } finally {
          setSaving(false);
          saveTimeoutRef.current = null;
        }
      }, 600);
    },
    [flow?.id, flow?.name, saving]
  );

  const persistFlow = useCallback(
    (nextNodes: FlowNode[], nextEdges: FlowEdge[]) => {
      const def = nodesAndEdgesToDefinition(nextNodes, nextEdges);
      saveDefinition(def);
    },
    [saveDefinition]
  );

  useEffect(() => {
    if (!flow?.id || nodes.length === 0) return;
    const t = setTimeout(() => persistFlow(nodes, edges), 400);
    return () => clearTimeout(t);
  }, [nodes, edges, flow?.id, persistFlow]);

  useEffect(() => {
    if (flowId === 'new') {
      navigate('/admin/flows', { replace: true });
      return;
    }
    flowService
      .get(flowId)
      .then((data) => {
        setFlow(data);
        const def = (data.definition as FlowDefinition) ?? DEFAULT_DEFINITION;
        const seq = Array.isArray(def.sequence) ? def.sequence : [];
        const withIds = seq.map((s: FlowStep) => ({ ...s, id: s.id || generateId() }));
        const nextDef = { properties: def.properties ?? {}, sequence: withIds };
        const { nodes: n, edges: e } = definitionToNodesAndEdges(nextDef);
        setNodes(n);
        setEdges(e);
      })
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { message?: string } } };
        toast.error(err.response?.data?.message || 'Erro ao carregar fluxo');
        navigate('/admin/flows');
      })
      .finally(() => setLoading(false));
  }, [flowId, navigate]);

  const addStep = (type: string) => {
    const meta = STEP_TYPES.find((s) => s.type === type);
    const name = meta?.defaultName ?? type;
    const step: FlowStep = {
      id: generateId(),
      componentType: 'task',
      type,
      name,
      properties: type === 'delay' ? { delaySeconds: 5 } : type === 'typing' ? { durationSeconds: 3 } : {},
    };
    const lastNode = nodes[nodes.length - 1];
    const newY = lastNode ? lastNode.y + NODE_HEIGHT + VERTICAL_GAP : 0;
    const newNode: FlowNode = { step, x: 0, y: newY };
    const newNodes = [...nodes, newNode];
    let newEdges = [...edges];
    if (lastNode) {
      newEdges = [...newEdges, { id: `e-${lastNode.step.id}-${step.id}`, sourceId: lastNode.step.id, targetId: step.id }];
    }
    setNodes(newNodes);
    setEdges(newEdges);
    persistFlow(newNodes, newEdges);
    setEditingStep(step);
  };

  const updateStep = (updated: FlowStep) => {
    setNodes((prev) =>
      prev.map((n) => (n.step.id === updated.id ? { ...n, step: updated } : n))
    );
    setEditingStep(null);
  };

  const removeStep = (id: string) => {
    const newNodes = nodes.filter((n) => n.step.id !== id);
    const newEdges = edges.filter((e) => e.sourceId !== id && e.targetId !== id);
    setNodes(newNodes);
    setEdges(newEdges);
    persistFlow(newNodes, newEdges);
    setEditingStep(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    if (e.detail === 2) return;
    dragRef.current = { nodeIndex: index, startX: e.clientX, startY: e.clientY, startNodeX: nodes[index].x, startNodeY: nodes[index].y };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const dragState = dragRef.current;
      if (!dragState) return;
      const dx = (e.clientX - dragState.startX) / scale;
      const dy = (e.clientY - dragState.startY) / scale;
      setNodes((prev) =>
        prev.map((n, i) =>
          i === dragState.nodeIndex
            ? { ...n, x: dragState.startNodeX + dx, y: dragState.startNodeY + dy }
            : n
        )
      );
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [scale]);

  const getNodeCenter = (node: FlowNode) => ({
    x: node.x + NODE_WIDTH / 2,
    y: node.y + NODE_HEIGHT,
  });
  const getNodeTop = (node: FlowNode) => ({
    x: node.x + NODE_WIDTH / 2,
    y: node.y,
  });

  if (loading || !flow) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-primary-600" size={40} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/flows')}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Voltar para lista"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{flow.name}</h1>
            {flow.command && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                Comando no chat:{' '}
                <code className="text-primary-600 dark:text-primary-400">
                  \{String(flow.command).replace(/^\\+/, '')}
                </code>
              </p>
            )}
          </div>
          {saving && (
            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Loader2 size={14} className="animate-spin" /> Salvando...
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate('/admin/flows')}
        >
          Voltar para fluxos
        </Button>
      </div>

      <div className="flex-1 min-h-[400px] rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 overflow-hidden flex">
        {/* Lateral: toolbox e controles */}
        <div className="w-72 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Passos disponíveis</h2>
            <div className="flex flex-wrap gap-2">
              {STEP_TYPES.map((s) => (
                <button
                  key={s.type}
                  type="button"
                  onClick={() => addStep(s.type)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300 w-full justify-start"
                >
                  {s.icon}
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Visualização</h3>
            <div className="flex gap-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 shadow p-1 w-fit">
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2, s + 0.1))}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Zoom in"
              >
                <ZoomIn size={18} />
              </button>
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Zoom out"
              >
                <ZoomOut size={18} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setScale(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Resetar"
              >
                <Maximize2 size={18} />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-auto">
            Arraste os nós no quadro à direita e dê duplo clique para editar.
          </p>
        </div>

        {/* Canvas à direita */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto relative"
          style={{
            backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          <div
            className="relative"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              minWidth: Math.max(400, nodes.reduce((w, n) => Math.max(w, n.x + NODE_WIDTH + 40), 0)),
              minHeight: nodes.length === 0 ? 300 : Math.max(400, nodes.reduce((h, n) => Math.max(h, n.y + NODE_HEIGHT + 80), 0)),
            }}
          >
            {/* SVG edges */}
            <svg
              className="absolute pointer-events-none"
              style={{ left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}
            >
              {edges.map((edge) => {
                const sourceNode = nodes.find((n) => n.step.id === edge.sourceId);
                const targetNode = nodes.find((n) => n.step.id === edge.targetId);
                if (!sourceNode || !targetNode) return null;
                const from = getNodeCenter(sourceNode);
                const to = getNodeTop(targetNode);
                const midY = (from.y + to.y) / 2;
                const path = `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
                return (
                  <path
                    key={edge.id}
                    d={path}
                    fill="none"
                    stroke="var(--color-primary-500, #3b82f6)"
                    strokeWidth={2}
                  />
                );
              })}
            </svg>

            {/* Nodes */}
            {nodes.map((node, index) => {
              const meta = STEP_TYPES.find((s) => s.type === node.step.type);
              const label = meta?.label ?? node.step.type;
              return (
                <div
                  key={node.step.id}
                  role="button"
                  tabIndex={0}
                  className="absolute cursor-grab active:cursor-grabbing px-4 py-3 rounded-xl border-2 min-w-[180px] shadow-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-600 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  style={{ left: node.x, top: node.y, width: NODE_WIDTH }}
                  onMouseDown={(e) => handleNodeMouseDown(e, index)}
                  onDoubleClick={() => setEditingStep(node.step)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-primary-600 dark:text-primary-400 flex-shrink-0">{meta?.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{node.step.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {editingStep && (
        <StepEditModal
          step={editingStep}
          onSave={updateStep}
          onClose={() => setEditingStep(null)}
          onDelete={() => removeStep(editingStep.id)}
        />
      )}
    </div>
  );
}

function StepEditModal({
  step,
  onSave,
  onClose,
  onDelete,
}: {
  step: FlowStep;
  onSave: (s: FlowStep) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(step.name);
  const [delaySeconds, setDelaySeconds] = useState((step.properties?.delaySeconds as number) ?? 5);
  const [text, setText] = useState((step.properties?.text as string) ?? '');
  const [url, setUrl] = useState((step.properties?.url as string) ?? '');
  const [caption, setCaption] = useState((step.properties?.caption as string) ?? '');
  const [durationSeconds, setDurationSeconds] = useState((step.properties?.durationSeconds as number) ?? 3);

  useEffect(() => {
    setName(step.name);
    setDelaySeconds((step.properties?.delaySeconds as number) ?? 5);
    setText((step.properties?.text as string) ?? '');
    setUrl((step.properties?.url as string) ?? '');
    setCaption((step.properties?.caption as string) ?? '');
    setDurationSeconds((step.properties?.durationSeconds as number) ?? 3);
  }, [step]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const properties: Record<string, unknown> = {};
    if (step.type === 'delay') properties.delaySeconds = delaySeconds;
    if (step.type === 'sendText') properties.text = text;
    if (step.type === 'sendMedia') {
      properties.url = url;
      properties.caption = caption;
    }
    if (step.type === 'sendAudio') properties.url = url;
    if (step.type === 'typing') properties.durationSeconds = durationSeconds;
    onSave({ ...step, name, properties });
  };

  const label = STEP_TYPES.find((s) => s.type === step.type)?.label ?? step.type;

  return (
    <Modal isOpen={true} title={`Editar: ${label}`} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome (rótulo)</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {step.type === 'delay' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Atraso (segundos)</label>
            <input
              type="number"
              min={1}
              max={3600}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
          </div>
        )}

        {step.type === 'sendText' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Texto da mensagem</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              placeholder="Digite a mensagem..."
            />
          </div>
        )}

        {(step.type === 'sendMedia' || step.type === 'sendAudio') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {step.type === 'sendAudio' ? 'URL do áudio' : 'URL da mídia'}
            </label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
        )}

        {step.type === 'sendMedia' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Legenda (opcional)</label>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
        )}

        {step.type === 'typing' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duração (segundos)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          {step.type !== 'trigger' && (
            <Button type="button" variant="danger" onClick={onDelete} className="mr-auto">
              <Trash2 size={14} className="mr-1" /> Excluir
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </Modal>
  );
}
