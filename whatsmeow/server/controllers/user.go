package controllers

import (
	"net/http"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/repositories/users"
	"github.com/verbeux-ai/whatsmiau/server/dto"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

type User struct {
	repo interfaces.UserRepository
}

func NewUser(repo interfaces.UserRepository) *User {
	return &User{
		repo: repo,
	}
}

func (u *User) Create(ctx echo.Context) error {
	var request dto.CreateUserRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	hashedPassword, err := utils.HashPassword(request.Password)
	if err != nil {
		zap.L().Error("failed to hash password", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to hash password")
	}

	user := &models.User{
		ID:        uuid.New().String(),
		Nome:      request.Nome,
		Email:     request.Email,
		Senha:     hashedPassword,
		Role:      request.Role,
		CompanyID: request.CompanyID,
	}

	ctxReq := ctx.Request().Context()
	if err := u.repo.Create(ctxReq, user); err != nil {
		zap.L().Error("failed to create user", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to create user")
	}

	return ctx.JSON(http.StatusCreated, dto.UserResponse{
		ID:        user.ID,
		Nome:      user.Nome,
		Email:     user.Email,
		Role:      user.Role,
		CompanyID: user.CompanyID,
		CreatedAt: user.CreatedAt.Format(time.RFC3339),
		UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
	})
}

func (u *User) List(ctx echo.Context) error {
	ctxReq := ctx.Request().Context()
	users, err := u.repo.List(ctxReq, nil)
	if err != nil {
		zap.L().Error("failed to list users", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list users")
	}

	var response []dto.UserResponse
	for _, user := range users {
		response = append(response, dto.UserResponse{
			ID:        user.ID,
			Nome:      user.Nome,
			Email:     user.Email,
			Role:      user.Role,
			CompanyID: user.CompanyID,
			CreatedAt: user.CreatedAt.Format(time.RFC3339),
			UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
		})
	}

	return ctx.JSON(http.StatusOK, response)
}

// ListByCompany - Admin can list users from their company
func (u *User) ListByCompany(ctx echo.Context) error {
	companyID, ok := ctx.Get("company_id").(*string)
	if !ok {
		companyIDStr, ok := ctx.Get("company_id").(string)
		if ok && companyIDStr != "" {
			companyID = &companyIDStr
		} else {
			// Super admin can see all, admin needs company_id
			role, _ := ctx.Get("user_role").(string)
			if role != "super_admin" {
				return utils.HTTPFail(ctx, http.StatusForbidden, nil, "company_id required for admin users")
			}
			companyID = nil
		}
	}

	ctxReq := ctx.Request().Context()
	users, err := u.repo.List(ctxReq, companyID)
	if err != nil {
		zap.L().Error("failed to list users by company", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list users")
	}

	var response []dto.UserResponse
	for _, user := range users {
		response = append(response, dto.UserResponse{
			ID:        user.ID,
			Nome:      user.Nome,
			Email:     user.Email,
			Role:      user.Role,
			CompanyID: user.CompanyID,
			CreatedAt: user.CreatedAt.Format(time.RFC3339),
			UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
		})
	}

	return ctx.JSON(http.StatusOK, response)
}

// CreateForCompany - Admin creates user for their company
func (u *User) CreateForCompany(ctx echo.Context) error {
	var request dto.CreateUserRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	// Get company_id from JWT token
	companyID, ok := ctx.Get("company_id").(*string)
	if !ok {
		companyIDStr, ok := ctx.Get("company_id").(string)
		if ok && companyIDStr != "" {
			companyID = &companyIDStr
		} else {
			role, _ := ctx.Get("user_role").(string)
			if role != "super_admin" {
				return utils.HTTPFail(ctx, http.StatusForbidden, nil, "company_id required for admin users")
			}
		}
	}

	// If admin, force company_id from token
	role, _ := ctx.Get("user_role").(string)
	if role == "admin" && companyID != nil {
		request.CompanyID = companyID
	}

	hashedPassword, err := utils.HashPassword(request.Password)
	if err != nil {
		zap.L().Error("failed to hash password", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to hash password")
	}

	user := &models.User{
		ID:        uuid.New().String(),
		Nome:      request.Nome,
		Email:     request.Email,
		Senha:     hashedPassword,
		Role:      request.Role,
		CompanyID: request.CompanyID,
	}

	ctxReq := ctx.Request().Context()
	if err := u.repo.Create(ctxReq, user); err != nil {
		zap.L().Error("failed to create user", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to create user")
	}

	return ctx.JSON(http.StatusCreated, dto.UserResponse{
		ID:        user.ID,
		Nome:      user.Nome,
		Email:     user.Email,
		Role:      user.Role,
		CompanyID: user.CompanyID,
		CreatedAt: user.CreatedAt.Format(time.RFC3339),
		UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
	})
}

// GetByIDFromCompany - Admin gets user from their company
func (u *User) GetByIDFromCompany(ctx echo.Context) error {
	id := ctx.Param("id")
	ctxReq := ctx.Request().Context()

	user, err := u.repo.GetByID(ctxReq, id)
	if err != nil {
		if err == users.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "user not found")
		}
		zap.L().Error("failed to get user", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to get user")
	}

	// Check if user belongs to admin's company
	role, _ := ctx.Get("user_role").(string)
	companyID, _ := ctx.Get("company_id").(string)
	if role == "admin" && companyID != "" {
		if user.CompanyID == nil || *user.CompanyID != companyID {
			return utils.HTTPFail(ctx, http.StatusForbidden, nil, "access denied: user does not belong to your company")
		}
	}

	return ctx.JSON(http.StatusOK, dto.UserResponse{
		ID:        user.ID,
		Nome:      user.Nome,
		Email:     user.Email,
		Role:      user.Role,
		CompanyID: user.CompanyID,
		CreatedAt: user.CreatedAt.Format(time.RFC3339),
		UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
	})
}

// UpdateFromCompany - Admin updates user from their company
func (u *User) UpdateFromCompany(ctx echo.Context) error {
	id := ctx.Param("id")
	var request dto.UpdateUserRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	ctxReq := ctx.Request().Context()
	existingUser, err := u.repo.GetByID(ctxReq, id)
	if err != nil {
		if err == users.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "user not found")
		}
		zap.L().Error("failed to get user", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to get user")
	}

	// Check if user belongs to admin's company
	role, _ := ctx.Get("user_role").(string)
	companyID, _ := ctx.Get("company_id").(string)
	if role == "admin" && companyID != "" {
		if existingUser.CompanyID == nil || *existingUser.CompanyID != companyID {
			return utils.HTTPFail(ctx, http.StatusForbidden, nil, "access denied: user does not belong to your company")
		}
		// Force company_id to remain the same
		request.CompanyID = existingUser.CompanyID
	}

	user := &models.User{
		Nome:      request.Nome,
		Email:     request.Email,
		Senha:     existingUser.Senha,
		Role:      request.Role,
		CompanyID: request.CompanyID,
	}

	if request.Password != nil && *request.Password != "" {
		hashedPassword, err := utils.HashPassword(*request.Password)
		if err != nil {
			zap.L().Error("failed to hash password", zap.Error(err))
			return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to hash password")
		}
		user.Senha = hashedPassword
	}

	updated, err := u.repo.Update(ctxReq, id, user)
	if err != nil {
		if err == users.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "user not found")
		}
		zap.L().Error("failed to update user", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to update user")
	}

	return ctx.JSON(http.StatusOK, dto.UserResponse{
		ID:        updated.ID,
		Nome:      updated.Nome,
		Email:     updated.Email,
		Role:      updated.Role,
		CompanyID: updated.CompanyID,
		CreatedAt: updated.CreatedAt.Format(time.RFC3339),
		UpdatedAt: updated.UpdatedAt.Format(time.RFC3339),
	})
}

// DeleteFromCompany - Admin deletes user from their company
func (u *User) DeleteFromCompany(ctx echo.Context) error {
	id := ctx.Param("id")
	ctxReq := ctx.Request().Context()

	// Check if user belongs to admin's company before deleting
	user, err := u.repo.GetByID(ctxReq, id)
	if err != nil {
		if err == users.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "user not found")
		}
		zap.L().Error("failed to get user", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to get user")
	}

	role, _ := ctx.Get("user_role").(string)
	companyID, _ := ctx.Get("company_id").(string)
	if role == "admin" && companyID != "" {
		if user.CompanyID == nil || *user.CompanyID != companyID {
			return utils.HTTPFail(ctx, http.StatusForbidden, nil, "access denied: user does not belong to your company")
		}
	}

	if err := u.repo.Delete(ctxReq, id); err != nil {
		if err == users.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "user not found")
		}
		zap.L().Error("failed to delete user", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to delete user")
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "user deleted successfully"})
}

func (u *User) GetByID(ctx echo.Context) error {
	id := ctx.Param("id")
	ctxReq := ctx.Request().Context()

	user, err := u.repo.GetByID(ctxReq, id)
	if err != nil {
		if err == users.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "user not found")
		}
		zap.L().Error("failed to get user", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to get user")
	}

	return ctx.JSON(http.StatusOK, dto.UserResponse{
		ID:        user.ID,
		Nome:      user.Nome,
		Email:     user.Email,
		Role:      user.Role,
		CompanyID: user.CompanyID,
		CreatedAt: user.CreatedAt.Format(time.RFC3339),
		UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
	})
}

func (u *User) Update(ctx echo.Context) error {
	id := ctx.Param("id")
	var request dto.UpdateUserRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	// Get existing user to preserve password if not updating
	ctxReq := ctx.Request().Context()
	existingUser, err := u.repo.GetByID(ctxReq, id)
	if err != nil {
		if err == users.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "user not found")
		}
		zap.L().Error("failed to get user", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to get user")
	}

	user := &models.User{
		Nome:      request.Nome,
		Email:     request.Email,
		Senha:     existingUser.Senha, // Keep existing password
		Role:      request.Role,
		CompanyID: request.CompanyID,
	}

	// Update password if provided
	if request.Password != nil && *request.Password != "" {
		hashedPassword, err := utils.HashPassword(*request.Password)
		if err != nil {
			zap.L().Error("failed to hash password", zap.Error(err))
			return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to hash password")
		}
		user.Senha = hashedPassword
	}

	updated, err := u.repo.Update(ctxReq, id, user)
	if err != nil {
		if err == users.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "user not found")
		}
		zap.L().Error("failed to update user", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to update user")
	}

	return ctx.JSON(http.StatusOK, dto.UserResponse{
		ID:        updated.ID,
		Nome:      updated.Nome,
		Email:     updated.Email,
		Role:      updated.Role,
		CompanyID: updated.CompanyID,
		CreatedAt: updated.CreatedAt.Format(time.RFC3339),
		UpdatedAt: updated.UpdatedAt.Format(time.RFC3339),
	})
}

func (u *User) Delete(ctx echo.Context) error {
	id := ctx.Param("id")
	ctxReq := ctx.Request().Context()

	if err := u.repo.Delete(ctxReq, id); err != nil {
		if err == users.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "user not found")
		}
		zap.L().Error("failed to delete user", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to delete user")
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "user deleted successfully"})
}

// UpdateProfile - User updates their own profile
func (u *User) UpdateProfile(ctx echo.Context) error {
	userID, _ := ctx.Get("user_id").(string)
	if userID == "" {
		return utils.HTTPFail(ctx, http.StatusUnauthorized, nil, "unauthorized")
	}

	var request dto.UpdateProfileRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	// Get existing user to preserve password and other fields if not updating
	ctxReq := ctx.Request().Context()
	existingUser, err := u.repo.GetByID(ctxReq, userID)
	if err != nil {
		if err == users.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "user not found")
		}
		zap.L().Error("failed to get user", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to get user")
	}

	user := &models.User{
		Nome:      request.Nome,
		Email:     request.Email,
		Senha:     existingUser.Senha,     // Keep existing password
		Role:      existingUser.Role,      // Keep existing role
		CompanyID: existingUser.CompanyID, // Keep existing company_id
	}

	// Update password if provided
	if request.Password != nil && *request.Password != "" {
		hashedPassword, err := utils.HashPassword(*request.Password)
		if err != nil {
			zap.L().Error("failed to hash password", zap.Error(err))
			return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to hash password")
		}
		user.Senha = hashedPassword
	}

	updated, err := u.repo.Update(ctxReq, userID, user)
	if err != nil {
		if err == users.ErrorNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "user not found")
		}
		zap.L().Error("failed to update profile", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to update profile")
	}

	return ctx.JSON(http.StatusOK, dto.UserResponse{
		ID:        updated.ID,
		Nome:      updated.Nome,
		Email:     updated.Email,
		Role:      updated.Role,
		CompanyID: updated.CompanyID,
		CreatedAt: updated.CreatedAt.Format(time.RFC3339),
		UpdatedAt: updated.UpdatedAt.Format(time.RFC3339),
	})
}
