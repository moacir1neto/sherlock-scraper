# WhatsMiau Frontend

Interface web moderna e completa para gerenciar instâncias do WhatsApp usando o WhatsMiau.

## Tecnologias

- **React 18** - Biblioteca JavaScript para construção de interfaces
- **TypeScript** - Tipagem estática para JavaScript
- **Vite** - Build tool rápida e moderna
- **TailwindCSS** - Framework CSS utility-first
- **React Router** - Roteamento para aplicações React
- **Axios** - Cliente HTTP
- **React Hot Toast** - Notificações elegantes
- **Lucide React** - Ícones modernos

## Desenvolvimento Local

### Pré-requisitos

- Node.js 18+ 
- npm ou yarn

### Instalação

```bash
cd frontend
npm install
```

### Executar em desenvolvimento

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3031`

### Build para produção

```bash
npm run build
```

### Preview da build

```bash
npm run preview
```

## Variáveis de Ambiente

Crie um arquivo `.env` na pasta `frontend`:

```env
VITE_API_URL=/api
VITE_API_KEY=sua-api-key-aqui
```

- `VITE_API_URL`: URL base da API (padrão: `/api` que será proxyado para o backend)
- `VITE_API_KEY`: Chave de API para autenticação (opcional se não configurado no backend)

## Estrutura do Projeto

```
frontend/
├── src/
│   ├── components/     # Componentes reutilizáveis
│   ├── pages/          # Páginas da aplicação
│   ├── services/       # Serviços de API
│   ├── types/          # Definições TypeScript
│   ├── hooks/          # Custom hooks
│   ├── utils/          # Funções utilitárias
│   ├── App.tsx         # Componente principal
│   └── main.tsx        # Entry point
├── public/             # Arquivos estáticos
├── index.html          # HTML principal
└── package.json        # Dependências
```

## Funcionalidades

- ✅ Gerenciamento completo de instâncias
- ✅ Conexão via QR Code
- ✅ Envio de mensagens de texto
- ✅ Atualização em tempo real do status
- ✅ Interface responsiva e moderna
- ✅ Notificações de sucesso/erro
- ✅ Feedback visual em todas as ações

## Docker

O frontend está incluído no `docker-compose.yml` principal do projeto. Para executar:

```bash
docker compose up -d --build
```

O frontend estará disponível em `http://localhost:3031`

