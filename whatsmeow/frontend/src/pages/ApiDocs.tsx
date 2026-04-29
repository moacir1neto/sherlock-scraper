import React, { useState } from 'react';
import { Book, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const BASE_URL = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.host}/v1`
  : 'https://seu-dominio.com/v1';

function CodeBlock({ children, title }: { children: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-lg bg-gray-900 border border-gray-700 overflow-hidden">
      {title && (
        <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-700 flex items-center justify-between">
          <span>{title}</span>
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1 text-gray-500 hover:text-white"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}
      <pre className="p-4 text-sm text-gray-300 font-mono overflow-x-auto whitespace-pre">
        {children}
      </pre>
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 text-left font-medium text-gray-900 dark:text-white"
      >
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        {title}
      </button>
      {open && <div className="p-4 pt-0 space-y-3">{children}</div>}
    </div>
  );
}

export function ApiDocs() {
  useAuth();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
          <Book className="text-primary-600 dark:text-primary-400" size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Documentação da API</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Como utilizar os endpoints com autenticação JWT
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Section title="Autenticação" defaultOpen={true}>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Envie o token JWT no header <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Authorization: Bearer SEU_TOKEN</code>.
            Obtenha o token fazendo login em <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">POST /v1/auth/login</code>.
          </p>
          <CodeBlock title="Exemplo (curl)">
{`curl -X POST ${BASE_URL}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"seu@email.com","password":"sua_senha"}'`}
          </CodeBlock>
        </Section>

        <Section title="Instâncias">
          <p className="text-sm text-gray-600 dark:text-gray-400">Listar, criar, conectar e gerenciar instâncias WhatsApp.</p>
          <CodeBlock title="GET /v1/instance - Listar instâncias">
{`curl -X GET "${BASE_URL}/instance" \\
  -H "Authorization: Bearer ${token || 'SEU_TOKEN'}"`}
          </CodeBlock>
          <CodeBlock title="POST /v1/instance - Criar instância">
{`curl -X POST "${BASE_URL}/instance" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"instanceName":"minha-instancia"}'`}
          </CodeBlock>
          <CodeBlock title="POST /v1/instance/:id/connect - Conectar (QR Code)">
{`curl -X POST "${BASE_URL}/instance/ID_DA_INSTANCIA/connect" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"id":"ID_DA_INSTANCIA"}'`}
          </CodeBlock>
          <CodeBlock title="GET /v1/instance/:id/status - Status da instância">
{`curl -X GET "${BASE_URL}/instance/ID_DA_INSTANCIA/status" \\
  -H "Authorization: Bearer SEU_TOKEN"'`}
          </CodeBlock>
        </Section>

        <Section title="Mensagens">
          <p className="text-sm text-gray-600 dark:text-gray-400">Enviar texto, mídia, reação, editar e revogar mensagens.</p>
          <CodeBlock title="POST /v1/instance/:id/message/text - Enviar texto">
{`curl -X POST "${BASE_URL}/instance/ID_DA_INSTANCIA/message/text" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"number":"5511999999999","text":"Olá!"}'`}
          </CodeBlock>
          <CodeBlock title="POST /v1/instance/:id/message/reaction - Reagir">
{`curl -X POST "${BASE_URL}/instance/ID_DA_INSTANCIA/message/reaction" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"key":{"remoteJid":"5511999999999@s.whatsapp.net","id":"MSG_ID","fromMe":false},"reaction":"👍"}'`}
          </CodeBlock>
          <CodeBlock title="POST /v1/instance/:id/message/revoke - Apagar para todos">
{`curl -X POST "${BASE_URL}/instance/ID_DA_INSTANCIA/message/revoke" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"key":{"remoteJid":"5511999999999@s.whatsapp.net","id":"MSG_ID","fromMe":true}}'`}
          </CodeBlock>
          <CodeBlock title="POST /v1/instance/:id/message/edit - Editar mensagem">
{`curl -X POST "${BASE_URL}/instance/ID_DA_INSTANCIA/message/edit" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"key":{"remoteJid":"5511999999999@s.whatsapp.net","id":"MSG_ID"},"text":"Texto editado"}'`}
          </CodeBlock>
        </Section>

        <Section title="Conversas e Chat">
          <p className="text-sm text-gray-600 dark:text-gray-400">Listar conversas e mensagens de um chat.</p>
          <CodeBlock title="GET /v1/instance/:id/chat - Listar conversas">
{`curl -X GET "${BASE_URL}/instance/ID_DA_INSTANCIA/chat?limit=50" \\
  -H "Authorization: Bearer SEU_TOKEN"'`}
          </CodeBlock>
          <CodeBlock title="GET /v1/instance/:id/chat/:chatId/messages - Mensagens do chat">
{`curl -X GET "${BASE_URL}/instance/ID_DA_INSTANCIA/chat/CHAT_ID/messages?limit=50" \\
  -H "Authorization: Bearer SEU_TOKEN"'`}
          </CodeBlock>
        </Section>

        <Section title="Webhooks">
          <p className="text-sm text-gray-600 dark:text-gray-400">Configurar URL de webhook e enviar evento de teste.</p>
          <CodeBlock title="PUT /v1/instance/update/:id - Configurar webhook">
{`curl -X PUT "${BASE_URL}/instance/update/ID_DA_INSTANCIA" \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"webhook":{"url":"https://seu-servidor.com/webhook","events":["message","connected","disconnected"],"base64":false}}'`}
          </CodeBlock>
          <CodeBlock title="POST /v1/instance/:id/webhook-send-test - Enviar teste">
{`curl -X POST "${BASE_URL}/instance/ID_DA_INSTANCIA/webhook-send-test" \\
  -H "Authorization: Bearer SEU_TOKEN"'`}
          </CodeBlock>
        </Section>

        <Section title="WebSocket (Chat em tempo real)">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Conecte-se ao WebSocket para receber novas mensagens e atualizações de status sem recarregar a página.
          </p>
          <CodeBlock title="URL do WebSocket">
{`ws://${typeof window !== 'undefined' ? window.location.host : 'SEU_HOST'}/v1/ws/chat?instance_id=ID_DA_INSTANCIA&token=SEU_TOKEN`}
          </CodeBlock>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Eventos: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">new_message</code> (payload: chat_id, message) e{' '}
            <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">message_status</code> (payload: message_id, status).
          </p>
        </Section>
      </div>
    </div>
  );
}
