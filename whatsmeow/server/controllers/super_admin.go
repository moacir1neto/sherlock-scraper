package controllers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/repositories/instances"
	"github.com/verbeux-ai/whatsmiau/server/dto"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.mau.fi/whatsmeow/types"
	"go.uber.org/zap"
)

type SuperAdmin struct {
	companyRepo  interfaces.CompanyRepository
	userRepo     interfaces.UserRepository
	instanceRepo interfaces.InstanceRepository
}

func NewSuperAdmin(companyRepo interfaces.CompanyRepository, userRepo interfaces.UserRepository, instanceRepo interfaces.InstanceRepository) *SuperAdmin {
	return &SuperAdmin{
		companyRepo:  companyRepo,
		userRepo:     userRepo,
		instanceRepo: instanceRepo,
	}
}

func (s *SuperAdmin) ListInstances(ctx echo.Context) error {
	c := ctx.Request().Context()
	result, err := s.instanceRepo.List(c, "")
	if err != nil {
		zap.L().Error("failed to list instances", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list instances")
	}

	var response []dto.ListInstancesResponse
	for _, instance := range result {
		jid, err := types.ParseJID(instance.RemoteJID)
		if err != nil {
			zap.L().Error("failed to parse jid", zap.Error(err))
		}

		response = append(response, dto.ListInstancesResponse{
			Instance:     &instance,
			OwnerJID:     jid.ToNonAD().String(),
			InstanceName: instance.ID,
		})
	}

	if len(response) == 0 {
		return ctx.JSON(http.StatusOK, []string{})
	}

	return ctx.JSON(http.StatusOK, response)
}

func (s *SuperAdmin) DeleteInstance(ctx echo.Context) error {
	id := ctx.Param("id")
	c := ctx.Request().Context()

	result, err := s.instanceRepo.List(c, id)
	if err != nil {
		zap.L().Error("failed to list instances", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list instances")
	}

	if len(result) == 0 {
		return utils.HTTPFail(ctx, http.StatusNotFound, instances.ErrorNotFound, "instance not found")
	}

	if err := s.instanceRepo.Delete(c, id); err != nil {
		if err == instances.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "instance not found")
		}
		zap.L().Error("failed to delete instance", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to delete instance")
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "instance deleted successfully"})
}
