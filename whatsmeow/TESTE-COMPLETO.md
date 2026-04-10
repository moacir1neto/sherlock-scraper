# ✅ Teste Completo - Tudo Funcionando!

## Status dos Serviços

✅ **Backend**: Rodando na porta 8081
✅ **Frontend**: Rodando na porta 3031  
✅ **PostgreSQL**: Rodando e saudável
✅ **Redis**: Rodando

## Credenciais de Acesso

- **Email**: `admin@admin.com`
- **Senha**: `admin123`

## Como Acessar

1. **Frontend**: http://localhost:3031/login
2. **API**: http://localhost:8081/v1/

## Teste de Login via API

```bash
curl -X POST http://localhost:8081/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"admin123"}'
```

## Criar Novo Super Admin

```bash
./create-admin.sh
```

## Verificar Status

```bash
docker compose ps
```

## Logs

```bash
# Backend
docker compose logs whatsmiau

# Frontend  
docker compose logs frontend
```

## Problemas Comuns

### Página branca no frontend
- Limpe o cache do navegador (Ctrl+Shift+R)
- Verifique o console do navegador (F12)
- Verifique se os assets estão sendo carregados

### Erro de login
- Verifique se o usuário existe: `docker compose exec db psql -U whatsmiau -d whatsmiau -c "SELECT email, role FROM users;"`
- Recrie o usuário: `./create-admin.sh`

### Erro de conexão
- Verifique se todos os containers estão rodando: `docker compose ps`
- Reinicie os serviços: `docker compose restart`

