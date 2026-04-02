# 🚀 Quick Start - Painel Super Admin

## Setup Completo em 3 Passos

### 1️⃣ Executar Setup Inicial

```bash
./init.sh
```

Este comando irá:
- ✅ Instalar dependências Go (JWT e bcrypt)
- ✅ Verificar compilação
- ✅ Criar usuário super admin padrão

### 2️⃣ Configurar .env (se necessário)

Edite o arquivo `.env` se precisar alterar configurações:

```env
PORT=8080
DIALECT_DB=sqlite3
DB_URL=file:data.db?_foreign_keys=on
```

### 3️⃣ Iniciar Servidor

```bash
go run main.go
```

## 🔐 Login

1. Acesse: `http://localhost:8080/login`
2. Use as credenciais padrão:
   - **Email**: `admin@admin.com`
   - **Senha**: `admin123`

3. Você será redirecionado para `/super-admin`

## 📋 Comandos Úteis

### Criar novo usuário super admin:
```bash
./create-super-admin.sh "Nome" "email@exemplo.com" "senha123"
```

### Apenas instalar dependências:
```bash
./setup.sh
```

### Criar usuário manualmente:
```bash
go run scripts/create-super-admin.go
```

## ⚠️ Importante

- Altere a senha padrão após o primeiro login!
- Em produção, use uma `API_KEY` segura no `.env`
- As migrations são executadas automaticamente na primeira execução

## 🆘 Problemas?

Consulte `README-SETUP.md` para troubleshooting detalhado.

