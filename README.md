# 🔎 Sherlock CRM — B2B Lead Management Platform

> **Sistema de CRM B2B Premium** para gerenciamento de leads frios gerados automaticamente pelo robô scraper Sherlock. Stack: Python Scraper + Go API (Fiber + GORM) + React (Vite + TypeScript) + PostgreSQL — completamente containerizado com Docker.

---

## 🏗️ Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    Sherlock Ecosystem                       │
│                                                             │
│  ┌──────────────────┐    CSV Files    ┌─────────────────┐   │
│  │  🤖 Python Robot  │ ─────────────► │  📂 /data/*.csv │   │
│  │  (Playwright)     │                └────────┬────────┘   │
│  └──────────────────┘                         │             │
│                                        Upload via UI        │
│                                               │             │
│  ┌────────────────────────────────────────────▼──────────┐  │
│  │              CRM Web Platform (Docker)                │  │
│  │                                                       │  │
│  │   ┌──────────────┐  REST API  ┌────────────────────┐  │  │
│  │   │  React/Vite  │ ◄────────► │  Go API (Fiber)    │  │  │
│  │   │  TypeScript  │   :3000    │  Clean Architecture│  │  │
│  │   │  Tailwind    │            │  JWT Auth (HS256)  │  │  │
│  │   │  Framer Mot. │            │  GORM + Postgres   │  │  │
│  │   │  :5173       │            └────────┬───────────┘  │  │
│  │   └──────────────┘                     │ GORM         │  │
│  │                                ┌───────▼───────────┐  │  │
│  │                                │  PostgreSQL 15     │  │  │
│  │                                │  (Persistent Vol.) │  │  │
│  │                                └───────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Componentes

| Componente | Tecnologia | Função |
| :--- | :--- | :--- |
| **Scraper** | Python + Playwright | Raspa dados do Google Maps e gera CSVs |
| **API** | Go 1.21 + Fiber v2 | Backend RESTful, Auth JWT, CSV Parser |
| **ORM** | GORM + Postgres Driver | Modelagem e acesso ao banco de dados |
| **Frontend** | React 18 + Vite + TypeScript | Interface SaaS, Kanban, CSV Upload |
| **UI** | Tailwind CSS + shadcn/ui + Framer Motion | Design system dark mode premium |
| **Banco** | PostgreSQL 15 | Persistência de leads e usuários |
| **Infra** | Docker + Docker Compose | Orquestração e ambiente reproducível |

---

## ✅ Pré-requisitos

- [Docker Engine](https://docs.docker.com/engine/install/) `>= 24.x`
- [Docker Compose](https://docs.docker.com/compose/) `>= v2.x` (incluso no Docker Desktop)
- Nenhuma instalação local de Go, Node.js ou Python é necessária.

---

## 🚀 Subindo o Ambiente Local

### 1. Clone e configure o projeto

```bash
git clone <seu-repositorio>
cd sherlock-scraper
```

### 2. Build e Start de todos os serviços

```bash
docker compose up -d --build
```

Aguarde: na primeira execução o Docker vai baixar as imagens base, instalar as dependências Go e npm e iniciar os 4 serviços (`db`, `api`, `frontend`, `sherlock`).

> **Verifique os logs** de inicialização com:
> ```bash
> docker compose logs -f api
> docker compose logs -f frontend
> ```

### 3. Seed do Usuário Administrador

Na primeira execução, o banco estará vazio. Crie o admin com:

```bash
docker compose exec api go run cmd/seed/main.go
```

Isso criará o seguinte acesso padrão:

| Campo | Valor |
| :--- | :--- |
| **Email** | `admin@sherlock.com` |
| **Password** | `premium_saas_2026` |

> **Customizando o Admin:** passe variáveis de ambiente antes do comando acima:
> ```bash
> ADMIN_EMAIL=seu@email.com ADMIN_PASSWORD=suaSenha docker compose exec api go run cmd/seed/main.go
> ```

### 4. Acesse a plataforma

| Serviço | URL |
| :--- | :--- |
| **CRM Web** | [http://localhost:5173](http://localhost:5173) |
| **API Go** | [http://localhost:3000/api/v1](http://localhost:3000/api/v1) |
| **PostgreSQL** | `localhost:5432` (user: `postgres`, pass: `password`, db: `crm`) |

---

## 📖 Como Usar a Plataforma

### 1. Login

Acesse `http://localhost:5173`, você verá a tela de login premium dark mode. Use as credenciais do Admin criadas no Seed.

### 2. Importando Leads via CSV

1. No menu lateral, clique em **"Import Leads"**
2. Arraste e solte seu arquivo `.csv` gerado pelo robô Sherlock na área destacada (ou clique para abrir o explorador de arquivos)
3. Aguarde o toast de confirmação **"Leads imported successfully!"**
4. Os leads são lidos, validados e inseridos em lote no PostgreSQL automaticamente

> **Formato do CSV esperado:**
> `Empresa, Nota, Qtd Avaliações, Resumo do Negócio, Endereço, Telefone, Tipo Telefone, Link WhatsApp, Site, Email, Instagram, Facebook, LinkedIn, TikTok, YouTube`

### 3. Kanban Board — Pipeline de Leads

1. Clique em **"Kanban Board"** no menu lateral
2. Os leads são exibidos em 6 colunas espelhando o funil de vendas:

| Coluna | Significado |
| :--- | :--- |
| 🔍 **Prospecção** | Lead novo, ainda não contatado |
| 📞 **Contatado** | Primeiro contato realizado |
| 📅 **Reunião Agendada** | Reunião marcada com o prospect |
| 🤝 **Negociação** | Em fase de proposta e negociação |
| ✅ **Ganho** | Negócio fechado com sucesso |
| ❌ **Perdido** | Oportunidade encerrada |

3. **Arraste** os cards entre as colunas. A mudança de status é salva no banco de dados em tempo real. Caso o servidor falhe, a interface reverte automaticamente (Optimistic UI).

### 4. Ações Rápidas nos Cards de Lead

Cada `LeadCard` exibe:
- **Nome da empresa** e **nota/avaliação** (ex: ⭐ 4.5)
- **Endereço** e **Telefone** com o tipo (celular/fixo)
- 💬 **Botão WhatsApp** — abre o chat direto em `wa.me` (nova aba)
- 🌐 **Botão Site** — abre o site do lead (nova aba)

---

## 🌐 Guia de Deploy em VPS (Produção)

### Servidor recomendado

- **Provedor:** DigitalOcean, Hetzner Cloud, ou Contabo
- **Plano mínimo:** 2 vCPUs / 4 GB RAM / 40 GB SSD
- **OS:** Ubuntu 22.04 LTS

### Passo a Passo

#### 1. Configurar o servidor

```bash
# Conecte via SSH
ssh root@SEU_IP_DO_SERVIDOR

# Instale Docker Engine
curl -fsSL https://get.docker.com | sh

# Adicione seu usuário ao grupo docker (reinicie a sessão depois)
usermod -aG docker $USER
```

#### 2. Clonar o projeto no servidor

```bash
git clone <seu-repositorio>
cd sherlock-scraper
```

#### 3. Configurar variáveis de produção

Crie um arquivo `.env` na raiz do projeto (nunca comite esse arquivo):

```bash
cat > .env << EOF
POSTGRES_PASSWORD=UmaSenhaForteAqui
JWT_SECRET=UmSegredoJWTLongoEAleatorioAqui
ADMIN_EMAIL=admin@suaempresa.com
ADMIN_PASSWORD=SenhaDoAdminAqui
EOF
```

Atualize o `docker-compose.yml` para usar essas variáveis com a sintaxe `${VARIABLE}`.

#### 4. Ajustar o Frontend para apontar para o domínio

No `docker-compose.yml`, mude a variável de ambiente do frontend:

```yaml
environment:
  - VITE_API_URL=https://api.seudominio.com/api/v1
```

#### 5. Build e subir os serviços

```bash
docker compose up -d --build
docker compose exec api go run cmd/seed/main.go  # Apenas na primeira vez
```

#### 6. Configurar Reverse Proxy com Nginx (HTTPS)

Instale o Nginx e o Certbot para TLS gratuito via Let's Encrypt:

```bash
apt install nginx certbot python3-certbot-nginx -y

# Configure os blocos server para seu domínio
# Frontend: seudominio.com -> localhost:5173
# API: api.seudominio.com -> localhost:3000

# Gere e aplique o certificado SSL
certbot --nginx -d seudominio.com -d api.seudominio.com
```

**Exemplo de bloco Nginx para o Frontend:**
```nginx
server {
    server_name seudominio.com;
    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### 7. Persistência e Backups

Os dados do PostgreSQL ficam no Docker Volume `pgdata`. Para backups automáticos, configure um cron job:

```bash
# Backup diário do banco às 03h
0 3 * * * docker compose exec -T db pg_dump -U postgres crm > /backups/crm_$(date +%F).sql
```

---

## 📁 Estrutura de Repositório

```
sherlock-scraper/
├── backend/                    # API Go (Clean Architecture)
│   ├── cmd/api/main.go         # Entrypoint
│   ├── cmd/seed/main.go        # Seeder de Admin
│   ├── internal/
│   │   ├── core/domain/        # Entidades (User, Lead, Enums)
│   │   ├── core/ports/         # Interfaces (ports)
│   │   ├── database/           # Conexão GORM + AutoMigrate
│   │   ├── handlers/           # Controllers HTTP (Fiber)
│   │   ├── middlewares/        # JWT Auth Middleware
│   │   ├── repositories/       # Acesso ao banco (GORM)
│   │   └── services/           # Lógica de negócio
│   └── pkg/csvparser/          # Parser de CSV
├── frontend/                   # SPA React/Vite (TypeScript)
│   └── src/
│       ├── components/         # UI e Layout components
│       ├── contexts/           # AuthContext (JWT state)
│       ├── pages/              # Login, KanbanBoard, CsvImport
│       ├── types/              # Interfaces TypeScript
│       └── lib/                # utils (shadcn/cn)
├── main.py                     # 🤖 Robô Scraper Python
├── docker-compose.yml          # Orquestração de todos os serviços
└── README.md                   # Este documento
```

---

## 🔑 Endpoints da API

Todos as rotas protegidas exigem o header `Authorization: Bearer <token>`.

| Método | Rota | Auth | Descrição |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | ❌ | Registrar novo usuário |
| `POST` | `/api/v1/auth/login` | ❌ | Login e geração de JWT |
| `GET` | `/api/v1/protected/me` | ✅ | Info do usuário logado |
| `GET` | `/api/v1/protected/leads` | ✅ | Listar todos os leads |
| `POST` | `/api/v1/protected/leads/upload` | ✅ | Importar CSV de leads |
| `PATCH` | `/api/v1/protected/leads/:id/status` | ✅ | Atualizar status Kanban |

---

*Construído com padrão de qualidade Big Tech. Designed to scale.* 🚀
