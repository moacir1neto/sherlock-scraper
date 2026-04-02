#!/bin/bash

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Criando usuário Super Admin${NC}"
echo ""

# Verifica se Go está instalado
if ! command -v go &> /dev/null; then
    echo -e "${RED}❌ Go não está instalado. Por favor, instale o Go primeiro.${NC}"
    exit 1
fi

# Usa o script Go para criar o usuário
go run scripts/create-super-admin.go "$@"

