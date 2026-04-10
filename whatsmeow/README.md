# miauWhats-painel

Painel web moderno e completo para gerenciamento de instâncias do WhatsApp, construído com React, TypeScript e TailwindCSS.

## 🚀 Funcionalidades

- **Gerenciamento de Instâncias**
  - Criar novas instâncias
  - Listar todas as instâncias
  - Ver status de conexão em tempo real
  - Conectar instâncias via QR Code
  - Desconectar e deletar instâncias

- **Envio de Mensagens**
  - Mensagens de texto
  - Imagens com legenda
  - Áudios (conversão automática para OGG/Opus)
  - Documentos (PDF, DOC, etc.)

- **Funções de Chat**
  - Enviar presença (indicar que está digitando)
  - Marcar mensagens como lidas
  - Verificar números WhatsApp

- **Interface Moderna**
  - Design responsivo e elegante
  - Atualizações em tempo real
  - Notificações de sucesso/erro
  - Sistema de abas para organizar funcionalidades

## 📋 Pré-requisitos

- Docker e Docker Compose
- Git

## 🛠️ Instalação e Uso

### Usando Docker Compose (Recomendado)

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/johnhoffmannsantos/miauWhats-painel.git
   cd miauWhats-painel
   ```

2. **Inicie os containers:**
   ```bash
   docker compose up -d --build
   ```

3. **Acesse o painel:**
   ```
   http://localhost:3031
   ```

### Usando Makefile

Para facilitar o uso, você pode usar o Makefile incluído:

```bash
# Iniciar os containers
make up

# Ver os logs
make logs

# Parar os containers
make down

# Ver todos os comandos disponíveis
make help
```

## 🧪 Testes

Execute o script de teste automatizado:

```bash
./test-api.sh nome-da-instancia
```

O script testa todas as funcionalidades da API automaticamente.

## 🏗️ Tecnologias

### Frontend
- React 18 com TypeScript
- Vite para build rápido
- TailwindCSS para estilização
- React Router para navegação
- Axios para requisições HTTP
- React Hot Toast para notificações

### Backend
- Go (Golang)
- PostgreSQL
- Redis

## 📡 API

A API está disponível em `http://localhost:8081` e segue o padrão REST.

### Principais Endpoints

- `POST /v1/instance` - Criar instância
- `GET /v1/instance` - Listar instâncias
- `POST /v1/instance/:id/connect` - Conectar instância
- `GET /v1/instance/:id/status` - Status da instância
- `POST /v1/instance/:id/message/text` - Enviar texto
- `POST /v1/instance/:id/message/image` - Enviar imagem
- `POST /v1/instance/:id/message/audio` - Enviar áudio
- `POST /v1/instance/:id/message/document` - Enviar documento
- `POST /v1/instance/:id/chat/presence` - Enviar presença
- `POST /v1/instance/:id/chat/read-messages` - Marcar como lida
- `POST /v1/chat/whatsappNumbers/:id` - Verificar números

## 🔧 Configuração

As configurações são feitas através de variáveis de ambiente no arquivo `docker-compose.yml`.

## 📝 Licença

Este projeto é de código aberto.

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.
