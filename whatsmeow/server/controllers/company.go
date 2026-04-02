package controllers

import (
	"net/http"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/repositories/companies"
	"github.com/verbeux-ai/whatsmiau/server/dto"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

type Company struct {
	repo interfaces.CompanyRepository
}

func NewCompany(repo interfaces.CompanyRepository) *Company {
	return &Company{
		repo: repo,
	}
}

func (c *Company) Create(ctx echo.Context) error {
	var request dto.CreateCompanyRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	company := &models.Company{
		ID:       uuid.New().String(),
		Nome:     request.Nome,
		CNPJ:     request.CNPJ,
		Email:    request.Email,
		Telefone: request.Telefone,
		Endereco: request.Endereco,
		Ativo:    request.Ativo,
	}

	ctxReq := ctx.Request().Context()
	if err := c.repo.Create(ctxReq, company); err != nil {
		zap.L().Error("failed to create company", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to create company")
	}

	return ctx.JSON(http.StatusCreated, dto.CompanyResponse{
		ID:        company.ID,
		Nome:      company.Nome,
		CNPJ:      company.CNPJ,
		Email:     company.Email,
		Telefone:  company.Telefone,
		Endereco:  company.Endereco,
		Ativo:     company.Ativo,
		CreatedAt: company.CreatedAt.Format(time.RFC3339),
		UpdatedAt: company.UpdatedAt.Format(time.RFC3339),
	})
}

func (c *Company) List(ctx echo.Context) error {
	ctxReq := ctx.Request().Context()
	companies, err := c.repo.List(ctxReq, "")
	if err != nil {
		zap.L().Error("failed to list companies", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list companies")
	}

	var response []dto.CompanyResponse
	for _, company := range companies {
		response = append(response, dto.CompanyResponse{
			ID:        company.ID,
			Nome:      company.Nome,
			CNPJ:      company.CNPJ,
			Email:     company.Email,
			Telefone:  company.Telefone,
			Endereco:  company.Endereco,
			Ativo:     company.Ativo,
			CreatedAt: company.CreatedAt.Format(time.RFC3339),
			UpdatedAt: company.UpdatedAt.Format(time.RFC3339),
		})
	}

	return ctx.JSON(http.StatusOK, response)
}

func (c *Company) GetByID(ctx echo.Context) error {
	id := ctx.Param("id")
	ctxReq := ctx.Request().Context()

	company, err := c.repo.GetByID(ctxReq, id)
	if err != nil {
		if err == companies.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "company not found")
		}
		zap.L().Error("failed to get company", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to get company")
	}

	return ctx.JSON(http.StatusOK, dto.CompanyResponse{
		ID:        company.ID,
		Nome:      company.Nome,
		CNPJ:      company.CNPJ,
		Email:     company.Email,
		Telefone:  company.Telefone,
		Endereco:  company.Endereco,
		Ativo:     company.Ativo,
		CreatedAt: company.CreatedAt.Format(time.RFC3339),
		UpdatedAt: company.UpdatedAt.Format(time.RFC3339),
	})
}

func (c *Company) Update(ctx echo.Context) error {
	id := ctx.Param("id")
	var request dto.UpdateCompanyRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	company := &models.Company{
		Nome:     request.Nome,
		CNPJ:     request.CNPJ,
		Email:    request.Email,
		Telefone: request.Telefone,
		Endereco: request.Endereco,
		Ativo:    request.Ativo,
	}

	ctxReq := ctx.Request().Context()
	updated, err := c.repo.Update(ctxReq, id, company)
	if err != nil {
		if err == companies.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "company not found")
		}
		zap.L().Error("failed to update company", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to update company")
	}

	return ctx.JSON(http.StatusOK, dto.CompanyResponse{
		ID:        updated.ID,
		Nome:      updated.Nome,
		CNPJ:      updated.CNPJ,
		Email:     updated.Email,
		Telefone:  updated.Telefone,
		Endereco:  updated.Endereco,
		Ativo:     updated.Ativo,
		CreatedAt: updated.CreatedAt.Format(time.RFC3339),
		UpdatedAt: updated.UpdatedAt.Format(time.RFC3339),
	})
}

func (c *Company) Delete(ctx echo.Context) error {
	id := ctx.Param("id")
	ctxReq := ctx.Request().Context()

	if err := c.repo.Delete(ctxReq, id); err != nil {
		if err == companies.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "company not found")
		}
		zap.L().Error("failed to delete company", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to delete company")
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "company deleted successfully"})
}

// GetByCompanyID - Admin gets their company profile
func (c *Company) GetByCompanyID(ctx echo.Context) error {
	userID, _ := ctx.Get("user_id").(string)
	userRole, _ := ctx.Get("user_role").(string)
	companyID, ok := ctx.Get("company_id").(string)
	
	zap.L().Info("GetByCompanyID called",
		zap.String("user_id", userID),
		zap.String("user_role", userRole),
		zap.Bool("company_id_ok", ok),
		zap.String("company_id", companyID),
	)
	
	if !ok || companyID == "" {
		zap.L().Warn("company_id not found in context", 
			zap.String("user_id", userID),
			zap.String("user_role", userRole),
		)
		return utils.HTTPFail(ctx, http.StatusForbidden, nil, "company_id required")
	}

	zap.L().Info("Getting company by ID", zap.String("company_id", companyID))

	ctxReq := ctx.Request().Context()
	company, err := c.repo.GetByID(ctxReq, companyID)
	if err != nil {
		if err == companies.ErrorNotFound {
			zap.L().Warn("Company not found", zap.String("company_id", companyID))
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "company not found")
		}
		zap.L().Error("failed to get company", zap.Error(err), zap.String("company_id", companyID))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to get company")
	}

	zap.L().Debug("Company found", zap.String("company_id", company.ID), zap.String("company_name", company.Nome))

	return ctx.JSON(http.StatusOK, dto.CompanyResponse{
		ID:        company.ID,
		Nome:      company.Nome,
		CNPJ:      company.CNPJ,
		Email:     company.Email,
		Telefone:  company.Telefone,
		Endereco:  company.Endereco,
		Ativo:     company.Ativo,
		CreatedAt: company.CreatedAt.Format(time.RFC3339),
		UpdatedAt: company.UpdatedAt.Format(time.RFC3339),
	})
}

// UpdateByCompanyID - Admin updates their company profile
func (c *Company) UpdateByCompanyID(ctx echo.Context) error {
	companyID, ok := ctx.Get("company_id").(string)
	if !ok || companyID == "" {
		return utils.HTTPFail(ctx, http.StatusForbidden, nil, "company_id required")
	}

	var request dto.UpdateCompanyRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	company := &models.Company{
		Nome:     request.Nome,
		CNPJ:     request.CNPJ,
		Email:    request.Email,
		Telefone: request.Telefone,
		Endereco: request.Endereco,
		Ativo:    request.Ativo,
	}

	ctxReq := ctx.Request().Context()
	updated, err := c.repo.Update(ctxReq, companyID, company)
	if err != nil {
		if err == companies.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "company not found")
		}
		zap.L().Error("failed to update company", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to update company")
	}

	return ctx.JSON(http.StatusOK, dto.CompanyResponse{
		ID:        updated.ID,
		Nome:      updated.Nome,
		CNPJ:      updated.CNPJ,
		Email:     updated.Email,
		Telefone:  updated.Telefone,
		Endereco:  updated.Endereco,
		Ativo:     updated.Ativo,
		CreatedAt: updated.CreatedAt.Format(time.RFC3339),
		UpdatedAt: updated.UpdatedAt.Format(time.RFC3339),
	})
}

