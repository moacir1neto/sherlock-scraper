#!/bin/bash

# Script de teste automatizado para API WhatsMiau
# Número de teste: 554196283086

INSTANCE_ID="${1:-teste}"
NUMBER="554196283086"
API_KEY="${API_KEY:-}"
BASE_URL="http://localhost:8081"

echo "=========================================="
echo "Teste Automatizado - API WhatsMiau"
echo "=========================================="
echo "Instância: $INSTANCE_ID"
echo "Número: $NUMBER"
echo "URL Base: $BASE_URL"
echo ""

# Função para fazer requisições
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo "----------------------------------------"
    echo "Teste: $description"
    echo "Endpoint: $endpoint"
    echo "Método: $method"
    
    if [ -n "$data" ]; then
        echo "Payload: $data"
        if [ -n "$API_KEY" ]; then
            response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X "$method" \
                "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "apikey: $API_KEY" \
                -d "$data")
        else
            response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X "$method" \
                "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data")
        fi
    else
        if [ -n "$API_KEY" ]; then
            response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X "$method" \
                "$BASE_URL$endpoint" \
                -H "apikey: $API_KEY")
        else
            response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X "$method" \
                "$BASE_URL$endpoint")
        fi
    fi
    
    http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE/d')
    
    echo "Status HTTP: $http_code"
    echo "Resposta: $body"
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo "✅ SUCESSO"
    else
        echo "❌ FALHOU"
    fi
    echo ""
}

# Teste 1: Enviar mensagem de texto
echo "1. TESTE DE MENSAGEM DE TEXTO"
make_request "POST" "/v1/instance/$INSTANCE_ID/message/text" \
    "{\"number\":\"$NUMBER\",\"text\":\"Teste automatizado - Mensagem de texto $(date +%H:%M:%S)\"}" \
    "Enviar mensagem de texto"

sleep 2

# Teste 2: Enviar imagem
echo "2. TESTE DE IMAGEM"
IMAGE_URL="https://picsum.photos/800/600"
make_request "POST" "/v1/instance/$INSTANCE_ID/message/image" \
    "{\"number\":\"$NUMBER\",\"media\":\"$IMAGE_URL\",\"mimetype\":\"image/jpeg\",\"caption\":\"Teste automatizado - Imagem $(date +%H:%M:%S)\"}" \
    "Enviar imagem"

sleep 2

# Teste 3: Enviar áudio
echo "3. TESTE DE ÁUDIO"
AUDIO_URL="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
make_request "POST" "/v1/instance/$INSTANCE_ID/message/audio" \
    "{\"number\":\"$NUMBER\",\"audio\":\"$AUDIO_URL\"}" \
    "Enviar áudio"

sleep 2

# Teste 4: Enviar documento
echo "4. TESTE DE DOCUMENTO"
DOC_URL="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
make_request "POST" "/v1/instance/$INSTANCE_ID/message/document" \
    "{\"number\":\"$NUMBER\",\"media\":\"$DOC_URL\",\"mimetype\":\"application/pdf\",\"fileName\":\"teste.pdf\"}" \
    "Enviar documento"

echo "=========================================="
echo "Testes concluídos!"
echo "=========================================="

