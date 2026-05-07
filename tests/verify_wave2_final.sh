#!/bin/bash
BACKEND_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQGFkbWluLmNvbSIsImV4cCI6MTc3ODM2NTYyMCwic3ViIjoiMjZkMzA1MjctMmNiYi00MWIyLWJkY2ItYzYyZjAzYzJlNjY1In0.95ZNuuRx4FU6ItsinuwR3E0bXYoEhcNPi4Tdw3HO-f8"
WHATS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNzFmZTRhY2QtMTJkOC00MGQ2LWFlMWUtNzFmMzBkOGFmZmQzIiwiZW1haWwiOiJhZG1pbkBhZG1pbi5jb20iLCJyb2xlIjoiYWRtaW4iLCJjb21wYW55X2lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAxIiwiZXhwIjoxNzc4MTkyOTE2LCJpYXQiOjE3NzgxMDY1MTZ9.vR0o2FrkYMVlSKIks7oe2iD0zwR94e5JvPmHAIFWa9k"
LEAD_ID="fe144680-7717-46bc-85e2-df860e828d52"
COMPANY_ID="00000000-0000-0000-0000-000000000001"

echo "1. Escutando SSE do WhatsMiau para CompanyID: $COMPANY_ID"
curl -s -N "http://localhost:8081/v1/admin/leads/events?token=$WHATS_TOKEN" > sse_final.log &
SSE_PID=$!

sleep 5

echo "2. Criando evento no Backend com CompanyID override: $COMPANY_ID"
curl -s -X POST http://localhost:3005/api/v1/protected/events/meeting \
  -H "Authorization: Bearer $BACKEND_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"company_id\": \"$COMPANY_ID\",
    \"lead_id\": \"$LEAD_ID\",
    \"lead_name\": \"Teste Final Wave 2\",
    \"scheduled_at\": \"2026-05-15T10:00:00Z\",
    \"metadata\": {\"final_test\": true}
  }"

echo -e "\n3. Aguardando 5s..."
sleep 5

kill $SSE_PID 2>/dev/null

echo "--- Conteúdo do Log SSE ---"
cat sse_final.log
