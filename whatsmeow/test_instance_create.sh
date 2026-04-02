#!/bin/bash

# Script de teste para criação de instância
# Testa se admin consegue criar instâncias

set -e

echo "🧪 TESTE AUTOMATIZADO - Criação de Instância"
echo "=============================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="${API_URL:-http://localhost:8080}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@admin.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

echo "📋 Configuração:"
echo "   API URL: $API_URL"
echo "   Admin Email: $ADMIN_EMAIL"
echo ""

# 1. Fazer login como admin
echo "1️⃣ Fazendo login como admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

echo "   Resposta do login: $LOGIN_RESPONSE"

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Erro: Não foi possível obter token${NC}"
  echo "   Resposta completa: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Token obtido: ${TOKEN:0:20}...${NC}"
echo ""

# 2. Verificar token e extrair informações
echo "2️⃣ Verificando informações do token..."
USER_INFO=$(echo $LOGIN_RESPONSE | grep -o '"user":{[^}]*}')
USER_ROLE=$(echo $LOGIN_RESPONSE | grep -o '"role":"[^"]*' | cut -d'"' -f4)

echo "   Role do usuário: $USER_ROLE"

if [ "$USER_ROLE" != "admin" ] && [ "$USER_ROLE" != "super_admin" ]; then
  echo -e "${RED}❌ Erro: Usuário não é admin ou super_admin (role: $USER_ROLE)${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Usuário tem role válido: $USER_ROLE${NC}"
echo ""

# 3. Tentar criar instância
INSTANCE_NAME="test-instance-$(date +%s)"
echo "3️⃣ Tentando criar instância: $INSTANCE_NAME"

CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/v1/instance" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"instanceName\":\"$INSTANCE_NAME\"}")

HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$CREATE_RESPONSE" | sed '$d')

echo "   HTTP Status Code: $HTTP_CODE"
echo "   Resposta: $RESPONSE_BODY"

if [ "$HTTP_CODE" == "201" ] || [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✅ SUCESSO! Instância criada com sucesso!${NC}"
  echo ""
  echo "4️⃣ Verificando se instância foi criada..."
  
  LIST_RESPONSE=$(curl -s -X GET "$API_URL/v1/instance" \
    -H "Authorization: Bearer $TOKEN")
  
  if echo "$LIST_RESPONSE" | grep -q "$INSTANCE_NAME"; then
    echo -e "${GREEN}✅ Instância encontrada na lista!${NC}"
    echo ""
    echo -e "${GREEN}🎉 TESTE PASSOU COM SUCESSO!${NC}"
    exit 0
  else
    echo -e "${YELLOW}⚠️ Instância criada mas não encontrada na lista${NC}"
    echo "   Resposta da lista: $LIST_RESPONSE"
    exit 1
  fi
elif [ "$HTTP_CODE" == "403" ]; then
  echo -e "${RED}❌ ERRO 403 - Forbidden${NC}"
  echo "   Mensagem: $RESPONSE_BODY"
  echo ""
  echo "🔍 Diagnóstico:"
  echo "   - Token: ${TOKEN:0:20}..."
  echo "   - Role: $USER_ROLE"
  echo "   - Verifique os logs do servidor para mais detalhes"
  exit 1
else
  echo -e "${RED}❌ ERRO: HTTP $HTTP_CODE${NC}"
  echo "   Resposta: $RESPONSE_BODY"
  exit 1
fi

