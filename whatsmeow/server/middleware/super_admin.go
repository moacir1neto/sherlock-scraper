package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func SuperAdminOnly(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		role, ok := c.Get("user_role").(string)
		if !ok || role != "super_admin" {
			return echo.NewHTTPError(http.StatusForbidden, "super admin access required")
		}

		return next(c)
	}
}

