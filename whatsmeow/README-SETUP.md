# Setup do Painel Super Admin

Este guia explica como configurar e usar o painel super admin.

## 🚀 Setup Rápido

Execute o script de inicialização completo:

```bash
./init.sh
```

Este script irá:
1. Instalar todas as dependências Go necessárias
2. Verificar a compilação do projeto
3. Criar um usuário super admin padrão (opcional)

## 📋 Setup Manual

### 1. Instalar Dependências

```bash
./setup.sh
```

Ou manualmente:

```bash
go get github.com/golang-jwt/jwt/v5
go get golang.org/x/crypto/bcrypt
go mod tidy
```

### 2. Configurar Variáveis de Ambiente

Crie ou edite o arquivo `.env`:

```env
PORT=8080
DEBUG_MODE=false
REDIS_URL=localhost:6379
REDIS_PASSWORD=
REDIS_TLS=false
API_KEY=your-secret-api-key-change-in-production
DIALECT_DB=sqlite3
DB_URL=file:data.db?_foreign_keys=on
```

Para PostgreSQL:

```env
DIALECT_DB=postgres
DB_URL=postgres://user:password@localhost:5432/whatsmiau?sslmode=disable
```

### 3. Criar Usuário Super Admin

#### Opção A: Usando o script (Recomendado)

```bash
./create-super-admin.sh
```

O script irá solicitar:
- Nome do super admin
- Email
- Senha

Ou com parâmetros:

```bash
./create-super-admin.sh "Nome Admin" "admin@example.com" "senha123"
```

#### Opção B: Usando o script Go diretamente

```bash
go run scripts/create-super-admin.go
```

#### Opção C: Via API (após criar primeiro usuário manualmente)

```bash
curl -X POST http://localhost:8080/api/v1/super-admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "nome": "Admin",
    "email": "admin@admin.com",
    "password": "admin123",
    "role": "super_admin"
  }'
```

### 4. Iniciar o Servidor

```bash
go run main.go
```

O servidor irá:
- Executar migrations automaticamente
- Criar as tabelas necessárias
- Iniciar na porta configurada (padrão: 8080)

## 🔐 Acessar o Painel

1. Acesse: `http://localhost:8080/login`
2. Faça login com as credenciais do super admin criado
3. Você será redirecionado para `/super-admin`

## 📝 Credenciais Padrão

Se você usou o script `init.sh` ou `create-super-admin.sh` sem parâmetros:

- **Email**: `admin@admin.com`
- **Senha**: `admin123`

⚠️ **IMPORTANTE**: Altere a senha após o primeiro login!

## 🛠️ Troubleshooting

### Erro: "Go não está instalado"

Instale o Go seguindo as instruções em: https://golang.org/doc/install

### Erro: "failed to run migrations"

- Verifique se o banco de dados está acessível
- Verifique as credenciais no arquivo `.env`
- Para SQLite, certifique-se de que o diretório existe e tem permissões de escrita

### Erro: "super admin access required"

- Certifique-se de que o usuário tem role `super_admin`
- Verifique se o token JWT está sendo enviado corretamente
- Faça logout e login novamente

### Erro ao criar usuário

- Certifique-se de que as migrations foram executadas
- Verifique se o email não está duplicado
- Para PostgreSQL, verifique se o usuário tem permissões de INSERT

## 📚 Estrutura de Rotas

### Autenticação
- `POST /api/v1/auth/login` - Login (não protegido)

### Super Admin (protegido)
- `GET /api/v1/super-admin/companies` - Listar empresas
- `POST /api/v1/super-admin/companies` - Criar empresa
- `GET /api/v1/super-admin/companies/:id` - Obter empresa
- `PUT /api/v1/super-admin/companies/:id` - Atualizar empresa
- `DELETE /api/v1/super-admin/companies/:id` - Excluir empresa

- `GET /api/v1/super-admin/users` - Listar usuários
- `POST /api/v1/super-admin/users` - Criar usuário
- `GET /api/v1/super-admin/users/:id` - Obter usuário
- `PUT /api/v1/super-admin/users/:id` - Atualizar usuário
- `DELETE /api/v1/super-admin/users/:id` - Excluir usuário

- `GET /api/v1/super-admin/instances` - Listar instâncias
- `DELETE /api/v1/super-admin/instances/:id` - Excluir instância

## 🔒 Segurança

- Todas as senhas são hasheadas com bcrypt (cost 10)
- Tokens JWT expiram em 24 horas
- Rotas de super admin requerem autenticação JWT e role `super_admin`
- Use HTTPS em produção
- Altere a `API_KEY` no `.env` para um valor seguro em produção

