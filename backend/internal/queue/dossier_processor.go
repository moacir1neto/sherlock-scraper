package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/hibiken/asynq"
)

// TaskTypeDossierAnalyze é a chave do worker Asynq para o pipeline de deep research.
const TaskTypeDossierAnalyze = "dossier:analyze"

// DossierAnalyzePayload é o payload enfileirado pelo handler HTTP.
type DossierAnalyzePayload struct {
	LeadID string `json:"lead_id"`
}

// NewDossierAnalyzeTask cria a task Asynq para o pipeline dossier:analyze.
func NewDossierAnalyzeTask(leadID string) (*asynq.Task, error) {
	payload, err := json.Marshal(DossierAnalyzePayload{LeadID: leadID})
	if err != nil {
		return nil, fmt.Errorf("NewDossierAnalyzeTask: %w", err)
	}
	return asynq.NewTask(TaskTypeDossierAnalyze, payload, asynq.MaxRetry(1)), nil
}

// HandleDossierAnalyzeTask é o handler Asynq registrado no server.
// Cria um DossierService e executa o pipeline completo de investigação.
func HandleDossierAnalyzeTask(ctx context.Context, t *asynq.Task) error {
	var payload DossierAnalyzePayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("HandleDossierAnalyzeTask: unmarshal payload: %w", err)
	}

	if payload.LeadID == "" {
		return fmt.Errorf("HandleDossierAnalyzeTask: lead_id vazio")
	}

	log.Printf("[Dossier] 🔍 Iniciando pipeline dossier:analyze para lead=%s", payload.LeadID)

	svc := NewDossierService()
	if err := svc.RunPipeline(ctx, payload.LeadID); err != nil {
		log.Printf("[Dossier] ❌ Pipeline falhou (lead=%s): %v", payload.LeadID, err)
		return err
	}

	log.Printf("[Dossier] ✅ Pipeline concluído (lead=%s)", payload.LeadID)
	return nil
}
