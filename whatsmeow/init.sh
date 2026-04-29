#!/bin/bash

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Inicializando projeto completo...${NC}"
echo ""

# Executa setup
echo -e "${YELLOW}📦 Executando setup...${NC}"
./setup.sh

echo ""
echo -e "${YELLOW}🔐 Criando usuário Super Admin padrão...${NC}"
echo -e "${BLUE}(Você pode pular esta etapa pressionando Ctrl+C)${NC}"
echo ""

# Cria super admin com valores padrão
./create-super-admin.sh Admin admin@admin.com admin123 || {
    echo -e "${YELLOW}⚠️  Criação de usuário pulada. Você pode criar manualmente depois.${NC}"
}

echo ""
echo -e "${GREEN}✅ Inicialização concluída!${NC}"
echo ""
echo -e "${BLUE}Para iniciar o servidor:${NC}"
echo "  go run main.go"
echo ""
echo -e "${BLUE}Para criar outro usuário super admin:${NC}"
echo "  ./create-super-admin.sh"

