#!/bin/bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQGFkbWluLmNvbSIsImV4cCI6MTc3ODM2NTYyMCwic3ViIjoiMjZkMzA1MjctMmNiYi00MWIyLWJkY2ItYzYyZjAzYzJlNjY1In0.95ZNuuRx4FU6ItsinuwR3E0bXYoEhcNPi4Tdw3HO-f8"
LEAD_ID="fe144680-7717-46bc-85e2-df860e828d52"

echo "1. Iniciando escuta SSE no WhatsMiau (Porta 8081)..."
curl -s -N "http://localhost:8081/admin/leads/events?token=$TOKEN" > sse_test.log &
SSE_PID=$!

sleep 5

echo "2. Disparando evento MEETING_SCHEDULED no Backend (Porta 3005)..."
curl -X POST http://localhost:3005/api/v1/protected/events/meeting \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"lead_id\": \"$LEAD_ID\",
    \"lead_name\": \"Teste UAT Automático\",
    \"scheduled_at\": \"2026-05-15T10:00:00Z\",
    \"metadata\": {\"test\": \"wave2-vertical\"}
  }"

echo -e "\n3. Aguardando processamento..."
sleep 5

kill $SSE_PID 2>/dev/null

echo "--- Resultado do Log SSE ---"
cat sse_test.log
