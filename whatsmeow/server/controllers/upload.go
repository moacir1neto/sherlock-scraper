package controllers

import (
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/env"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

const uploadDir = "data/uploads"
const maxUploadSize = 50 << 20 // 50 MB

// UploadFile handles POST multipart form "file", saves to data/uploads, returns { url: "/v1/uploads/<filename>" }.
func UploadFile(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return utils.HTTPFail(c, http.StatusBadRequest, err, "file is required")
	}
	if file.Size > maxUploadSize {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "file too large (max 50MB)")
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		ext = ".bin"
	}
	// restrict extension to common media types
	allowed := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
		".mp3": true, ".ogg": true, ".m4a": true, ".wav": true, ".aac": true,
		".mp4": true, ".webm": true,
		".pdf": true, ".doc": true, ".docx": true, ".xls": true, ".xlsx": true,
	}
	if !allowed[ext] {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "file type not allowed. Use image, audio, video or document.")
	}
	name := uuid.New().String() + ext
	dest := filepath.Join(uploadDir, name)
	if err := ensureUploadDir(); err != nil {
		zap.L().Error("upload dir", zap.Error(err))
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to create upload dir")
	}
	if err := saveFormFileSafe(file, dest); err != nil {
		zap.L().Error("save upload", zap.Error(err))
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to save file")
	}
	base := strings.TrimSuffix(env.Get().PublicURL, "/")
	url := base + "/v1/uploads/" + name
	return c.JSON(http.StatusOK, map[string]string{"url": url})
}

func ensureUploadDir() error {
	return os.MkdirAll(uploadDir, 0755)
}

func saveFormFileSafe(fh *multipart.FileHeader, dest string) error {
	absBase, _ := filepath.Abs(uploadDir)
	absDest, err := filepath.Abs(dest)
	if err != nil {
		return err
	}
	if !strings.HasPrefix(absDest, absBase+string(filepath.Separator)) && absDest != absBase {
		return os.ErrPermission
	}
	src, err := fh.Open()
	if err != nil {
		return err
	}
	defer src.Close()
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, src)
	return err
}

// ServeUpload serves GET /v1/uploads/:filename from data/uploads with path traversal check.
func ServeUpload(c echo.Context) error {
	filename := c.Param("filename")
	if filename == "" || strings.Contains(filename, "..") || filepath.Base(filename) != filename {
		return c.NoContent(http.StatusBadRequest)
	}
	fullPath := filepath.Join(uploadDir, filename)
	absBase, _ := filepath.Abs(uploadDir)
	absFull, err := filepath.Abs(fullPath)
	if err != nil {
		return c.NoContent(http.StatusNotFound)
	}
	if !strings.HasPrefix(absFull, absBase+string(filepath.Separator)) && absFull != absBase {
		return c.NoContent(http.StatusForbidden)
	}
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		return c.NoContent(http.StatusNotFound)
	}
	return c.File(fullPath)
}
