package controllers

import (
	"errors"
	"net/http"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/repositories/users"
	"github.com/verbeux-ai/whatsmiau/server/dto"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

type Auth struct {
	userRepo  interfaces.UserRepository
	auditRepo interfaces.AuditLogRepository
}

func NewAuth(userRepo interfaces.UserRepository, auditRepo interfaces.AuditLogRepository) *Auth {
	return &Auth{
		userRepo:  userRepo,
		auditRepo: auditRepo,
	}
}

func (a *Auth) Login(ctx echo.Context) error {
	var request dto.LoginRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	// Log da tentativa de login
	zap.L().Info("Tentativa de login",
		zap.String("email", request.Email),
		zap.Int("password_length", len(request.Password)),
	)

	reqCtx := ctx.Request().Context()
	user, err := a.userRepo.GetByEmail(reqCtx, request.Email)
	if err != nil {
		if errors.Is(err, users.ErrorNotFound) {
			zap.L().Warn("Usuário não encontrado", zap.String("email", request.Email))
			return utils.HTTPFail(ctx, http.StatusUnauthorized, err, "invalid credentials")
		}
		zap.L().Error("failed to get user by email", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to authenticate")
	}

	// Log do usuário encontrado (sem senha)
	if user.CompanyID != nil {
		zap.L().Info("Usuário encontrado",
			zap.String("user_id", user.ID),
			zap.String("email", user.Email),
			zap.String("role", user.Role),
			zap.String("company_id", *user.CompanyID),
			zap.Int("hash_length", len(user.Senha)),
			zap.Bool("hash_empty", user.Senha == ""),
		)
	} else {
		zap.L().Warn("Usuário encontrado SEM company_id",
			zap.String("user_id", user.ID),
			zap.String("email", user.Email),
			zap.String("role", user.Role),
			zap.Int("hash_length", len(user.Senha)),
			zap.Bool("hash_empty", user.Senha == ""),
		)
	}

	// Verificar senha
	passwordMatch := utils.CheckPasswordHash(request.Password, user.Senha)
	zap.L().Info("Verificação de senha",
		zap.Bool("password_match", passwordMatch),
		zap.String("email", request.Email),
	)

	if !passwordMatch {
		zap.L().Warn("Senha inválida",
			zap.String("email", request.Email),
			zap.Int("password_length", len(request.Password)),
			zap.Int("hash_length", len(user.Senha)),
		)
		return utils.HTTPFail(ctx, http.StatusUnauthorized, nil, "invalid credentials")
	}

	// Log company_id before generating token
	if user.CompanyID != nil {
		zap.L().Info("Generating token with company_id",
			zap.String("user_id", user.ID),
			zap.String("email", user.Email),
			zap.String("role", user.Role),
			zap.String("company_id", *user.CompanyID),
		)
	} else {
		zap.L().Warn("User has no company_id",
			zap.String("user_id", user.ID),
			zap.String("email", user.Email),
			zap.String("role", user.Role),
		)
	}

	token, err := utils.GenerateToken(user.ID, user.Email, user.Role, user.CompanyID)
	if err != nil {
		zap.L().Error("failed to generate token", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to generate token")
	}

	if a.auditRepo != nil {
		auditLog := &models.AuditLog{
			CompanyID:  user.CompanyID,
			UserID:     &user.ID,
			UserEmail:  user.Email,
			Action:     "login",
			EntityType: "user",
			EntityID:   user.ID,
		}
		_ = a.auditRepo.Create(reqCtx, auditLog)
	}

	return ctx.JSON(http.StatusOK, dto.LoginResponse{
		Token: token,
		User: dto.AuthUserResponse{
			ID:        user.ID,
			Nome:      user.Nome,
			Email:     user.Email,
			Role:      user.Role,
			CompanyID: user.CompanyID,
		},
	})
}
