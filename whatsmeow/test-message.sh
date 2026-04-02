#!/bin/bash

# Script de teste para enviar mensagens via API WhatsMiau
# Uso: ./test-message.sh <instance_id> <numero> <mensagem>

INSTANCE_ID=${1:-"teste"}
NUMBER=${2:-"5511999999999"}
MESSAGE=${3:-"Teste de mensagem"}

API_URL="http://localhost:8081"
ENDPOINT="${API_URL}/v1/instance/${INSTANCE_ID}/message/text"

echo "=== Teste de Envio de Mensagem ==="
echo "Instância: ${INSTANCE_ID}"
echo "Número: ${NUMBER}"
echo "Mensagem: ${MESSAGE}"
echo ""

# Verifica se a instância existe e está conectada
echo "1. Verificando status da instância..."
STATUS_RESPONSE=$(curl -s "${API_URL}/v1/instance/${INSTANCE_ID}/status")
echo "Status: ${STATUS_RESPONSE}"
echo ""

# Envia a mensagem
echo "2. Enviando mensagem..."
RESPONSE=$(curl -s -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"${NUMBER}\",
    \"text\": \"${MESSAGE}\"
  }")

echo "Resposta:"
echo "${RESPONSE}" | jq '.' 2>/dev/null || echo "${RESPONSE}"
echo ""

# Verifica se foi sucesso
if echo "${RESPONSE}" | grep -q "status"; then
  echo "✅ Mensagem enviada com sucesso!"
else
  echo "❌ Erro ao enviar mensagem"
  echo "Detalhes: ${RESPONSE}"
fi


