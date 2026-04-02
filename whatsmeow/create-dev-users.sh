#!/bin/bash

# Script para criar usuários de desenvolvimento (super_admin, admin, user)
# Funciona executando via Docker build temporário

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔐 Criando usuários de desenvolvimento${NC}"
echo ""

# Verifica se o docker compose está rodando
if ! docker compose ps | grep -q "whatsmiau.*Up"; then
    echo -e "${RED}❌ Servidor não está rodando. Por favor, inicie primeiro:${NC}"
    echo "  docker compose up -d"
    exit 1
fi

# Constrói uma imagem temporária com o código Go
echo -e "${YELLOW}📦 Construindo imagem temporária...${NC}"
docker build --target builder -t temp-builder . > /dev/null 2>&1

# Executa o script usando a imagem temporária
docker run --rm \
    --network miauwhats_whatsmiau-network \
    -e DIALECT_DB=postgres \
    -e DB_URL="postgres://whatsmiau:123456@db:5432/whatsmiau?sslmode=disable" \
    temp-builder go run scripts/create-dev-users.go

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Usuários criados com sucesso!${NC}"
    echo ""
    echo -e "${BLUE}Você pode fazer login em:${NC}"
    echo "  http://localhost:3031/login"
    echo ""
    echo -e "${BLUE}Credenciais:${NC}"
    echo "  Super Admin: superadmin@admin.com / admin123"
    echo "  Admin:       admin@admin.com / admin123"
    echo "  Usuário:     user@admin.com / admin123"
else
    echo -e "${RED}❌ Erro ao criar usuários${NC}"
    exit 1
fi

