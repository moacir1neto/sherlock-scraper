package services

import (
	"context"
	"errors"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
	"github.com/digitalcombo/sherlock-scraper/backend/pkg/csvparser"
)

type leadService struct {
	repo ports.LeadRepository
}

func NewLeadService(repo ports.LeadRepository) ports.LeadService {
	return &leadService{repo: repo}
}

func (s *leadService) ImportCSV(ctx context.Context, csvData [][]string, nicho string) error {
	leads := csvparser.MapToLeads(csvData, nicho)
	if len(leads) == 0 {
		return errors.New("no valid leads found in CSV")
	}

	return s.repo.CreateBatch(ctx, leads)
}

func (s *leadService) GetLeads(ctx context.Context) ([]*domain.Lead, error) {
	return s.repo.GetAll(ctx)
}

func (s *leadService) ChangeStatus(ctx context.Context, id string, status domain.KanbanStatus) error {
	switch status {
	case domain.StatusProspeccao, domain.StatusContatado, domain.StatusReuniaoAgendada, domain.StatusNegociacao, domain.StatusGanho, domain.StatusPerdido:
		return s.repo.UpdateStatus(ctx, id, status)
	default:
		return errors.New("invalid kanban status")
	}
}
