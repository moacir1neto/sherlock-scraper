package controllers

import (
	"net/http"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/repositories/sectors"
	"github.com/verbeux-ai/whatsmiau/server/dto"
	"github.com/verbeux-ai/whatsmiau/utils"
)

type Sector struct {
	repo        interfaces.SectorRepository
	sectorUser  interfaces.SectorUserRepository
	auditRepo   interfaces.AuditLogRepository
}

func NewSector(repo interfaces.SectorRepository, sectorUser interfaces.SectorUserRepository, auditRepo interfaces.AuditLogRepository) *Sector {
	return &Sector{repo: repo, sectorUser: sectorUser, auditRepo: auditRepo}
}

// List setores da empresa do JWT. Para role=user, retorna apenas setores aos quais o usuário está atribuído (nunca o Geral).
func (s *Sector) List(ctx echo.Context) error {
	companyID, _ := ctx.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(ctx, http.StatusForbidden, nil, "company_id required")
	}
	role, _ := ctx.Get("user_role").(string)
	userID, _ := ctx.Get("user_id").(string)

	list, err := s.repo.ListByCompanyID(ctx.Request().Context(), companyID)
	if err != nil {
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list sectors")
	}
	// User: só vê setores em que está em sector_users (nunca vê Geral)
	if role == "user" && s.sectorUser != nil {
		allowedIDs, _ := s.sectorUser.ListSectorIDsByUserID(ctx.Request().Context(), userID)
		allowedSet := make(map[string]struct{}, len(allowedIDs))
		for _, id := range allowedIDs {
			allowedSet[id] = struct{}{}
		}
		var filtered []dto.SectorWithUsers
		for _, sec := range list {
			if _, ok := allowedSet[sec.ID]; ok && !sec.IsDefault {
				var userIDs []string
				if s.sectorUser != nil {
					userIDs, _ = s.sectorUser.ListUserIDsBySectorID(ctx.Request().Context(), sec.ID)
				}
				filtered = append(filtered, dto.SectorWithUsers{Sector: sec, UserIDs: userIDs})
			}
		}
		return ctx.JSON(http.StatusOK, filtered)
	}
	// Admin: retorna todos os setores com user_ids
	var out []dto.SectorWithUsers
	for _, sec := range list {
		var userIDs []string
		if s.sectorUser != nil {
			userIDs, _ = s.sectorUser.ListUserIDsBySectorID(ctx.Request().Context(), sec.ID)
		}
		if userIDs == nil {
			userIDs = []string{}
		}
		out = append(out, dto.SectorWithUsers{Sector: sec, UserIDs: userIDs})
	}
	return ctx.JSON(http.StatusOK, out)
}

// Create cria um novo setor para a empresa.
func (s *Sector) Create(ctx echo.Context) error {
	companyID, _ := ctx.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(ctx, http.StatusForbidden, nil, "company_id required")
	}
	var req dto.CreateSectorRequest
	if err := ctx.Bind(&req); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "invalid body")
	}
	if err := validator.New().Struct(&req); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "validation failed")
	}
	sector := &models.Sector{
		CompanyID: companyID,
		Name:      req.Name,
		Slug:      req.Slug,
		IsDefault: false,
		CreatedAt: time.Now(),
	}
	if err := s.repo.Create(ctx.Request().Context(), sector); err != nil {
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to create sector")
	}
	if s.sectorUser != nil && len(req.UserIDs) > 0 {
		_ = s.sectorUser.SetUsersForSector(ctx.Request().Context(), sector.ID, req.UserIDs)
	}
	if s.auditRepo != nil {
		userID, _ := ctx.Get("user_id").(string)
		userEmail, _ := ctx.Get("user_email").(string)
		_ = s.auditRepo.Create(ctx.Request().Context(), &models.AuditLog{
			CompanyID:  &companyID,
			UserID:     &userID,
			UserEmail:  userEmail,
			Action:     "create_sector",
			EntityType: "sector",
			EntityID:   sector.ID,
			NewValue:   sector.Name,
		})
	}
	return ctx.JSON(http.StatusCreated, sector)
}

// GetByID retorna um setor específico da empresa (com user_ids).
func (s *Sector) GetByID(ctx echo.Context) error {
	companyID, _ := ctx.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(ctx, http.StatusForbidden, nil, "company_id required")
	}
	id := ctx.Param("id")
	sector, err := s.repo.GetByID(ctx.Request().Context(), id, companyID)
	if err != nil {
		if err == sectors.ErrNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "sector not found")
		}
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to get sector")
	}
	var userIDs []string
	if s.sectorUser != nil {
		userIDs, _ = s.sectorUser.ListUserIDsBySectorID(ctx.Request().Context(), id)
	}
	if userIDs == nil {
		userIDs = []string{}
	}
	return ctx.JSON(http.StatusOK, dto.SectorWithUsers{Sector: *sector, UserIDs: userIDs})
}

// Update atualiza nome/slug de um setor.
func (s *Sector) Update(ctx echo.Context) error {
	companyID, _ := ctx.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(ctx, http.StatusForbidden, nil, "company_id required")
	}
	id := ctx.Param("id")
	var req dto.UpdateSectorRequest
	if err := ctx.Bind(&req); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "invalid body")
	}
	req.ID = id
	if err := validator.New().Struct(&req); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "validation failed")
	}
	sector := &models.Sector{
		ID:        id,
		CompanyID: companyID,
		Name:      req.Name,
		Slug:      req.Slug,
	}
	if err := s.repo.Update(ctx.Request().Context(), sector); err != nil {
		if err == sectors.ErrNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "sector not found")
		}
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to update sector")
	}
	if s.sectorUser != nil && req.UserIDs != nil {
		_ = s.sectorUser.SetUsersForSector(ctx.Request().Context(), id, req.UserIDs)
	}
	if s.auditRepo != nil {
		userID, _ := ctx.Get("user_id").(string)
		userEmail, _ := ctx.Get("user_email").(string)
		_ = s.auditRepo.Create(ctx.Request().Context(), &models.AuditLog{
			CompanyID:  &companyID,
			UserID:     &userID,
			UserEmail:  userEmail,
			Action:     "update_sector",
			EntityType: "sector",
			EntityID:   id,
			NewValue:   sector.Name,
		})
	}
	return ctx.JSON(http.StatusOK, sector)
}

// Delete remove um setor (exceto Geral).
func (s *Sector) Delete(ctx echo.Context) error {
	companyID, _ := ctx.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(ctx, http.StatusForbidden, nil, "company_id required")
	}
	id := ctx.Param("id")
	if err := s.repo.Delete(ctx.Request().Context(), id, companyID); err != nil {
		if err == sectors.ErrNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "sector not found or cannot delete default sector")
		}
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to delete sector")
	}
	if s.auditRepo != nil {
		userID, _ := ctx.Get("user_id").(string)
		userEmail, _ := ctx.Get("user_email").(string)
		_ = s.auditRepo.Create(ctx.Request().Context(), &models.AuditLog{
			CompanyID:  &companyID,
			UserID:     &userID,
			UserEmail:  userEmail,
			Action:     "delete_sector",
			EntityType: "sector",
			EntityID:   id,
		})
	}
	return ctx.JSON(http.StatusOK, map[string]string{"message": "sector deleted"})
}

