#!/bin/bash

set -e

echo "🚀 Configurando o projeto..."

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verifica se Go está instalado
if ! command -v go &> /dev/null; then
    echo -e "${RED}❌ Go não está instalado. Por favor, instale o Go primeiro.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Go encontrado${NC}"

# Instala dependências Go
echo -e "${YELLOW}📦 Instalando dependências Go...${NC}"
go get github.com/golang-jwt/jwt/v5
go get golang.org/x/crypto/bcrypt
go mod tidy

echo -e "${GREEN}✓ Dependências instaladas${NC}"

# Verifica se .env existe
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ Arquivo .env não encontrado. Criando .env de exemplo...${NC}"
    cat > .env << EOF
PORT=8080
DEBUG_MODE=false
REDIS_URL=localhost:6379
REDIS_PASSWORD=
REDIS_TLS=false
API_KEY=your-secret-api-key-change-in-production
DIALECT_DB=sqlite3
DB_URL=file:data.db?_foreign_keys=on
EOF
    echo -e "${GREEN}✓ Arquivo .env criado. Por favor, configure as variáveis de ambiente.${NC}"
fi

# Compila o projeto para verificar se há erros
echo -e "${YELLOW}🔨 Compilando o projeto...${NC}"
if go build -o /tmp/whatsmiau-test main.go; then
    echo -e "${GREEN}✓ Compilação bem-sucedida${NC}"
    rm -f /tmp/whatsmiau-test
else
    echo -e "${RED}❌ Erro na compilação${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Setup concluído com sucesso!${NC}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo "1. Configure o arquivo .env com suas credenciais"
echo "2. Execute o servidor: go run main.go"
echo "3. O primeiro usuário super admin será criado automaticamente na primeira execução"
echo "   ou use o script create-super-admin.sh para criar manualmente"

