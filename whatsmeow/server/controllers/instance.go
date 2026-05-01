package controllers

import (
	"encoding/base64"
	"errors"
	"math/rand/v2"
	"net/http"

	"github.com/verbeux-ai/whatsmiau/env"
	"github.com/verbeux-ai/whatsmiau/lib/whatsmiau"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/repositories/instances"
	"go.mau.fi/whatsmeow/types"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/skip2/go-qrcode"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/server/dto"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

type Instance struct {
	repo         interfaces.InstanceRepository
	instanceUser interfaces.InstanceUserRepository
	whatsmiau    *whatsmiau.Whatsmiau
}

func NewInstances(repository interfaces.InstanceRepository, instanceUser interfaces.InstanceUserRepository, whatsmiau *whatsmiau.Whatsmiau) *Instance {
	return &Instance{
		repo:         repository,
		instanceUser: instanceUser,
		whatsmiau:    whatsmiau,
	}
}

func (s *Instance) Create(ctx echo.Context) error {
	// LOG IMEDIATO - Primeira linha do controller
	zap.L().Info("=== INSTANCE CREATE CONTROLLER CALLED ===",
		zap.String("method", ctx.Request().Method),
		zap.String("path", ctx.Request().URL.Path),
		zap.String("url", ctx.Request().URL.String()),
		zap.String("remote_addr", ctx.Request().RemoteAddr),
	)

	// Log todos os valores do contexto para debug
	userID, userIDOk := ctx.Get("user_id").(string)
	userEmail, _ := ctx.Get("user_email").(string)
	role, roleOk := ctx.Get("user_role").(string)
	companyID, _ := ctx.Get("company_id").(string)

	zap.L().Info("Create instance endpoint called - context values",
		zap.String("user_id", userID),
		zap.Bool("user_id_ok", userIDOk),
		zap.String("user_email", userEmail),
		zap.String("user_role", role),
		zap.Bool("role_ok", roleOk),
		zap.String("company_id", companyID),
	)

	// Permissão liberada para todos os usuários autenticados
	zap.L().Info("User authenticated - allowing instance creation",
		zap.String("user_role", role),
		zap.String("user_id", userID),
	)

	var request dto.CreateInstanceRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	request.ID = request.InstanceName
	if request.Instance == nil {
		request.Instance = &models.Instance{
			ID: request.InstanceName,
		}
	} else {
		request.Instance.ID = request.InstanceName
	}
	request.RemoteJID = ""

	// Associar instância ao company_id do usuário
	if companyID != "" {
		companyIDPtr := &companyID
		request.Instance.CompanyID = companyIDPtr
		zap.L().Info("Associando instância ao company_id",
			zap.String("instance_id", request.InstanceName),
			zap.String("company_id", companyID),
			zap.String("user_id", userID),
		)
	} else {
		zap.L().Warn("Usuário não tem company_id associado",
			zap.String("user_id", userID),
			zap.String("user_role", role),
		)
	}

	if len(request.ProxyHost) <= 0 && len(env.Get().ProxyAddresses) > 0 {
		rd := rand.IntN(len(env.Get().ProxyAddresses))
		proxyUrl := env.Get().ProxyAddresses[rd]

		proxy, err := parseProxyURL(proxyUrl)
		if err != nil {
			return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "invalid proxy url on env")
		}
		request.InstanceProxy = *proxy
	}

	c := ctx.Request().Context()

	// Log antes de salvar
	companyIDValue := ""
	if request.Instance.CompanyID != nil {
		companyIDValue = *request.Instance.CompanyID
	}
	zap.L().Info("Saving instance to repository",
		zap.String("instance_id", request.Instance.ID),
		zap.String("company_id", companyIDValue),
		zap.String("user_id", userID),
	)

	if err := s.repo.Create(c, request.Instance); err != nil {
		zap.L().Error("failed to create instance", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to create instance")
	}

	zap.L().Info("Instance created successfully",
		zap.String("instance_id", request.Instance.ID),
		zap.String("company_id", companyIDValue),
	)

	return ctx.JSON(http.StatusCreated, dto.CreateInstanceResponse{
		Instance: request.Instance,
	})
}

func (s *Instance) Update(ctx echo.Context) error {
	var request dto.UpdateInstanceRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	c := ctx.Request().Context()
	wh := models.InstanceWebhook{
		Url:    request.Webhook.URL,
		Base64: &[]bool{request.Webhook.Base64}[0],
		Events: request.Webhook.Events,
	}
	if request.Webhook.Secret != nil {
		wh.SecretUpdate = request.Webhook.Secret
	}
	instance, err := s.repo.Update(c, request.ID, &models.Instance{
		ID:          request.ID,
		DisplayName: request.DisplayName,
		Webhook:     wh,
	})
	if err != nil {
		if errors.Is(err, instances.ErrorNotFound) {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "instance not found")
		}
		zap.L().Error("failed to create instance", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to update instance")
	}
	// Do not expose secret in response
	if instance != nil && instance.Webhook.Secret != "" {
		instance.Webhook.Secret = "••••"
	}

	return ctx.JSON(http.StatusCreated, dto.UpdateInstanceResponse{
		Instance: instance,
	})
}

func (s *Instance) List(ctx echo.Context) error {
	c := ctx.Request().Context()
	var request dto.ListInstancesRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}
	if request.InstanceName == "" {
		request.InstanceName = request.ID
	}

	result, err := s.repo.List(c, request.InstanceName)
	if err != nil {
		zap.L().Error("failed to list instances", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list instances")
	}

	// Filtrar instâncias baseado no role e acesso (instance_users para user)
	role, _ := ctx.Get("user_role").(string)
	companyID, _ := ctx.Get("company_id").(string)
	userID, _ := ctx.Get("user_id").(string)

	var allowedInstanceIDs map[string]struct{}
	if role == "user" && s.instanceUser != nil {
		ids, _ := s.instanceUser.ListInstanceIDsByUserID(c, userID)
		allowedInstanceIDs = make(map[string]struct{}, len(ids))
		for _, id := range ids {
			allowedInstanceIDs[id] = struct{}{}
		}
	}

	var filteredResult []models.Instance
	for _, instance := range result {
		// Super admin vê todas
		if role == "super_admin" {
			filteredResult = append(filteredResult, instance)
			continue
		}
		// User: só vê instâncias às quais está atribuído em instance_users
		if role == "user" {
			if allowedInstanceIDs != nil && len(allowedInstanceIDs) > 0 {
				if _, ok := allowedInstanceIDs[instance.ID]; ok {
					filteredResult = append(filteredResult, instance)
				}
			}
			continue
		}
		// Admin vê apenas instâncias da empresa
		if role == "admin" {
			instanceCompanyID := ""
			if instance.CompanyID != nil {
				instanceCompanyID = *instance.CompanyID
			}
			if companyID != "" && instanceCompanyID == companyID {
				filteredResult = append(filteredResult, instance)
			}
			continue
		}
	}

	zap.L().Info("List instances - filtered result",
		zap.Int("filtered_count", len(filteredResult)),
	)

	var response []dto.ListInstancesResponse
	for i := range filteredResult {
		inst := filteredResult[i]
		if inst.Webhook.Secret != "" {
			inst.Webhook.Secret = "••••"
		}
		jid, err := types.ParseJID(inst.RemoteJID)
		if err != nil {
			zap.L().Error("failed to parse jid", zap.Error(err))
		}
		response = append(response, dto.ListInstancesResponse{
			Instance:     &inst,
			OwnerJID:     jid.ToNonAD().String(),
			InstanceName: inst.ID,
		})
	}

	if len(response) == 0 {
		return ctx.JSON(http.StatusOK, []string{})
	}

	return ctx.JSON(http.StatusOK, response)
}

func (s *Instance) Connect(ctx echo.Context) error {
	c := ctx.Request().Context()
	var request dto.ConnectInstanceRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	result, err := s.repo.List(c, request.ID)
	if err != nil {
		zap.L().Error("failed to list instances", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list instances")
	}

	if len(result) == 0 {
		return utils.HTTPFail(ctx, http.StatusNotFound, err, "instance not found")
	}

	qrCode, err := s.whatsmiau.Connect(c, request.ID)
	if err != nil {
		zap.L().Error("failed to connect instance", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to connect instance")
	}

	// Already connected (no QR needed)
	if qrCode == "ALREADY_CONNECTED" {
		return ctx.JSON(http.StatusOK, dto.ConnectInstanceResponse{
			Status:    "connected",
			Message:   "instance already connected",
			Connected: true,
		})
	}

	// QR code ready
	if qrCode != "" && qrCode != "ALREADY_CONNECTED" {
		png, err := qrcode.Encode(qrCode, qrcode.Medium, 512)
		if err != nil {
			zap.L().Error("failed to encode qrcode", zap.Error(err))
			return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to encode qrcode")
		}
		return ctx.JSON(http.StatusOK, dto.ConnectInstanceResponse{
			Status:    "qr_ready",
			Message:   "Escaneie o QR Code com seu WhatsApp",
			Connected: false,
			Base64:    "data:image/png;base64," + base64.StdEncoding.EncodeToString(png),
		})
	}

	// Observer started but QR not ready yet
	return ctx.JSON(http.StatusOK, dto.ConnectInstanceResponse{
		Status:    "generating",
		Message:   "Negociando com WhatsApp...",
		Connected: false,
	})
}

func (s *Instance) ConnectQRBuffer(ctx echo.Context) error {
	c := ctx.Request().Context()
	var request dto.ConnectInstanceRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	result, err := s.repo.List(c, request.ID)
	if err != nil {
		zap.L().Error("failed to list instances", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list instances")
	}

	if len(result) == 0 {
		return utils.HTTPFail(ctx, http.StatusNotFound, err, "instance not found")
	}

	qrCode, err := s.whatsmiau.Connect(c, request.ID)
	if err != nil {
		zap.L().Error("failed to connect instance", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to connect instance")
	}
	if qrCode != "" {
		png, err := qrcode.Encode(qrCode, qrcode.Medium, 256)
		if err != nil {
			zap.L().Error("failed to encode qrcode", zap.Error(err))
			return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to encode qrcode")
		}
		return ctx.Blob(http.StatusOK, "image/png", png)
	}

	return ctx.NoContent(http.StatusOK)
}

func (s *Instance) Status(ctx echo.Context) error {
	c := ctx.Request().Context()
	var request dto.ConnectInstanceRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	result, err := s.repo.List(c, request.ID)
	if err != nil {
		zap.L().Error("failed to list instances", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list instances")
	}

	if len(result) == 0 {
		return utils.HTTPFail(ctx, http.StatusNotFound, err, "instance not found")
	}

	status, err := s.whatsmiau.Status(request.ID)
	if err != nil {
		zap.L().Error("failed to get status instance", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to get status instance")
	}

	return ctx.JSON(http.StatusOK, dto.StatusInstanceResponse{
		ID:     request.ID,
		Status: string(status),
		Instance: &dto.StatusInstanceResponseEvolutionCompatibility{
			InstanceName: request.ID,
			State:        string(status),
		},
	})
}

func (s *Instance) Logout(ctx echo.Context) error {
	c := ctx.Request().Context()
	var request dto.DeleteInstanceRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	result, err := s.repo.List(c, request.ID)
	if err != nil {
		zap.L().Error("failed to list instances", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list instances")
	}

	if len(result) == 0 {
		return utils.HTTPFail(ctx, http.StatusNotFound, err, "instance not found")
	}

	if err := s.whatsmiau.Logout(c, request.ID); err != nil {
		zap.L().Error("failed to logout instance", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to logout instance")
	}

	return ctx.JSON(http.StatusOK, dto.DeleteInstanceResponse{
		Message: "instance logout successfully",
	})
}

func (s *Instance) Delete(ctx echo.Context) error {
	c := ctx.Request().Context()
	var request dto.DeleteInstanceRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	result, err := s.repo.List(c, request.ID)
	if err != nil {
		zap.L().Error("failed to list instances", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list instances")
	}

	if len(result) == 0 {
		return ctx.JSON(http.StatusOK, dto.DeleteInstanceResponse{
			Message: "instance doesn't exists",
		})
	}

	if err := s.whatsmiau.Logout(ctx.Request().Context(), request.ID); err != nil {
		zap.L().Error("failed to disconnect instance", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to logout instance")
	}

	if err := s.repo.Delete(c, request.ID); err != nil {
		zap.L().Error("failed to delete instance", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to delete instance")
	}

	return ctx.JSON(http.StatusOK, dto.DeleteInstanceResponse{
		Message: "instance deleted",
	})
}

// ensureInstanceAccessForAdmin verifica se o usuário (admin/super_admin) tem permissão sobre a instância. Retorna nil se OK.
func (s *Instance) ensureInstanceAccessForAdmin(c echo.Context, instanceID string) (*models.Instance, error) {
	ctx := c.Request().Context()
	role, _ := c.Get("user_role").(string)
	companyID, _ := c.Get("company_id").(string)
	list, err := s.repo.List(ctx, instanceID)
	if err != nil || len(list) == 0 {
		return nil, utils.HTTPFail(c, http.StatusNotFound, nil, "instance not found")
	}
	inst := &list[0]
	if role == "super_admin" {
		return inst, nil
	}
	if role == "admin" && companyID != "" && inst.CompanyID != nil && *inst.CompanyID == companyID {
		return inst, nil
	}
	return nil, utils.HTTPFail(c, http.StatusForbidden, nil, "access denied to this instance")
}

// ListInstanceUsers GET /instance/:id/users — lista user_ids com acesso à instância (apenas admin/super_admin).
func (s *Instance) ListInstanceUsers(ctx echo.Context) error {
	if s.instanceUser == nil {
		return utils.HTTPFail(ctx, http.StatusServiceUnavailable, nil, "instance users not available")
	}
	instanceID := ctx.Param("id")
	if _, err := s.ensureInstanceAccessForAdmin(ctx, instanceID); err != nil {
		return err
	}
	c := ctx.Request().Context()
	ids, err := s.instanceUser.ListUserIDsByInstanceID(c, instanceID)
	if err != nil {
		zap.L().Error("list instance users failed", zap.Error(err), zap.String("instance", instanceID))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list instance users")
	}
	if ids == nil {
		ids = []string{}
	}
	return ctx.JSON(http.StatusOK, dto.InstanceUsersResponse{UserIDs: ids})
}

// SetInstanceUsers PUT /instance/:id/users — define usuários com acesso à instância (apenas admin/super_admin).
func (s *Instance) SetInstanceUsers(ctx echo.Context) error {
	if s.instanceUser == nil {
		return utils.HTTPFail(ctx, http.StatusServiceUnavailable, nil, "instance users not available")
	}
	instanceID := ctx.Param("id")
	if _, err := s.ensureInstanceAccessForAdmin(ctx, instanceID); err != nil {
		return err
	}
	var req dto.SetInstanceUsersRequest
	if err := ctx.Bind(&req); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "invalid body")
	}
	c := ctx.Request().Context()
	if err := s.instanceUser.SetUsersForInstance(c, instanceID, req.UserIDs); err != nil {
		zap.L().Error("set instance users failed", zap.Error(err), zap.String("instance", instanceID))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to set instance users")
	}
	ids, _ := s.instanceUser.ListUserIDsByInstanceID(c, instanceID)
	if ids == nil {
		ids = []string{}
	}
	return ctx.JSON(http.StatusOK, dto.InstanceUsersResponse{UserIDs: ids})
}
