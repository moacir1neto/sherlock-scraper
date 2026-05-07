#!/bin/bash
BACKEND_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQGFkbWluLmNvbSIsImV4cCI6MTc3ODM2NTYyMCwic3ViIjoiMjZkMzA1MjctMmNiYi00MWIyLWJkY2ItYzYyZjAzYzJlNjY1In0.95ZNuuRx4FU6ItsinuwR3E0bXYoEhcNPi4Tdw3HO-f8"
LEAD_ID="fe144680-7717-46bc-85e2-df860e828d52"
COMPANY_ID="00000000-0000-0000-0000-000000000001"

# Agendar para daqui a 3 dias para garantir que os lembretes entrem na fila de agendados (scheduled)
SCHEDULED_TIME=$(date -u -d "+3 days" +"%Y-%m-%dT%H:%M:%SZ")

echo "1. Agendando reunião para $SCHEDULED_TIME..."
RESP=$(curl -s -X POST http://localhost:3005/api/v1/protected/events/meeting \
  -H "Authorization: Bearer $BACKEND_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"company_id\": \"$COMPANY_ID\",
    \"lead_id\": \"$LEAD_ID\",
    \"lead_name\": \"Teste Wave 3 Robustez\",
    \"scheduled_at\": \"$SCHEDULED_TIME\"
  }")

EVENT_ID=$(echo $RESP | grep -oP '(?<="id":")[^"]*')
if [ -z "$EVENT_ID" ]; then echo "Erro ao criar evento: $RESP"; exit 1; fi
echo "Evento criado: $EVENT_ID"

sleep 2

echo "2. Verificando tarefas no Asynq (Redis)..."
# No Asynq, as tarefas agendadas ficam em asynq:{default}:scheduled (ZSET)
TASKS_COUNT=$(docker exec sherlock-scraper-redis-1 redis-cli zcard "asynq:{default}:scheduled")
echo "Total de tarefas agendadas no Redis: $TASKS_COUNT (Esperado: 3 para este evento)"

echo -e "\n3. Verificando persistência no DB..."
docker exec sherlock-scraper-db-1 psql -U postgres -d crm -c "SELECT id, status, reminders FROM business_events WHERE id = '$EVENT_ID';"

echo -e "\n4. Testando CANCELAMENTO..."
curl -s -X DELETE http://localhost:3005/api/v1/protected/events/$EVENT_ID \
  -H "Authorization: Bearer $BACKEND_TOKEN"

sleep 2

echo -e "\n5. Verificando se as tarefas foram REMOVIDAS do Asynq..."
TASKS_COUNT_AFTER=$(docker exec sherlock-scraper-redis-1 redis-cli zcard "asynq:{default}:scheduled")
echo "Total de tarefas agendadas no Redis após cancelamento: $TASKS_COUNT_AFTER"

if [ "$TASKS_COUNT_AFTER" -lt "$TASKS_COUNT" ]; then
  echo "Cancelamento real no Asynq: PASS ✅"
else
  echo "Cancelamento real no Asynq: FAIL ❌ (Nenhuma tarefa removida)"
fi

echo -e "\n6. Verificando status no DB..."
docker exec sherlock-scraper-db-1 psql -U postgres -d crm -c "SELECT id, status FROM business_events WHERE id = '$EVENT_ID';"
