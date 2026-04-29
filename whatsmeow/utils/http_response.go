package utils

import (
	"github.com/labstack/echo/v4"
)

type HTTPErrorResponse struct {
	Error        error  `json:"-"` // não serializar para evitar 500 em erros complexos
	Message      string `json:"message"`
	ErrorMessage string `json:"errorMessage,omitempty"`
}

func HTTPFail(ctx echo.Context, code int, err error, message string) error {
	result := &HTTPErrorResponse{
		Error:   err,
		Message: message,
	}

	if err != nil {
		result.ErrorMessage = err.Error()
	}

	return ctx.JSON(code, result)
}
