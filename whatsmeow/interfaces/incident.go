package interfaces

import (
	"github.com/verbeux-ai/whatsmiau/models"
	"golang.org/x/net/context"
)

type IncidentRepository interface {
	Create(ctx context.Context, incident *models.Incident) error
	List(ctx context.Context, limit int, offset int, code, tenantID string) ([]models.Incident, int, error)
	GetByID(ctx context.Context, id string) (*models.Incident, error)
}
