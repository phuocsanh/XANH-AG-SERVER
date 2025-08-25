package upload

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gn-farm-go-server/internal/service/upload"
)

type UploadHandler interface {
	UploadFile(c *gin.Context)
	DeleteFile(c *gin.Context)
	MarkFileAsUsed(c *gin.Context)
}

type uploadHandler struct {
	uploadService upload.UploadService
}

func NewUploadHandler(uploadService upload.UploadService) UploadHandler {
	return &uploadHandler{uploadService: uploadService}
}

type UploadResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func (h *uploadHandler) UploadFile(c *gin.Context) {
	// Lấy file từ request
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, UploadResponse{
			Code:    http.StatusBadRequest,
			Message: "Không tìm thấy file",
		})
		return
	}

	// Lấy thư mục từ query param (nếu có)
	folder := c.DefaultQuery("folder", "temp")

	// Upload file lên Cloudinary
	uploadResult, err := h.uploadService.UploadImage(c, file, folder)
	if err != nil {
		c.JSON(http.StatusInternalServerError, UploadResponse{
			Code:    http.StatusInternalServerError,
			Message: "Lỗi khi upload file: " + err.Error(),
		})
		return
	}

	// Set upload response vào context để middleware có thể track
	uploadResponseMap := map[string]interface{}{
		"public_id":  uploadResult.PublicID,
		"secure_url": uploadResult.SecureURL,
		"url":        uploadResult.URL,
		"format":     uploadResult.Format,
		"file_size":  uploadResult.FileSize,
		"file_name":  uploadResult.FileName,
		"folder":     uploadResult.Folder,
	}
	c.Set("upload_response", uploadResponseMap)

	// Trả về thông tin file đã upload
	c.JSON(http.StatusOK, UploadResponse{
		Code:    http.StatusOK,
		Message: "Upload file thành công",
		Data: gin.H{
			"url":       uploadResult.SecureURL,
			"public_id": uploadResult.PublicID,
			"file_name": uploadResult.FileName,
			"file_size": uploadResult.FileSize,
			"folder":    uploadResult.Folder,
		},
	})
}

func (h *uploadHandler) DeleteFile(c *gin.Context) {
	publicID := c.Param("public_id")
	if publicID == "" {
		c.JSON(http.StatusBadRequest, UploadResponse{
			Code:    http.StatusBadRequest,
			Message: "Thiếu thông tin public_id",
		})
		return
	}

	err := h.uploadService.DeleteFile(c.Request.Context(), publicID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, UploadResponse{
			Code:    http.StatusInternalServerError,
			Message: "Lỗi khi xóa file: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, UploadResponse{
		Code:    http.StatusOK,
		Message: "Xóa file thành công",
	})
}

func (h *uploadHandler) MarkFileAsUsed(c *gin.Context) {
	publicID := c.Param("public_id")
	if publicID == "" {
		c.JSON(http.StatusBadRequest, UploadResponse{
			Code:    http.StatusBadRequest,
			Message: "Thiếu thông tin public_id",
		})
		return
	}

	// Cập nhật tag từ "temporary" thành "in_use"
	err := h.uploadService.UpdateTags(c.Request.Context(), publicID, []string{"in_use"})
	if err != nil {
		c.JSON(http.StatusInternalServerError, UploadResponse{
			Code:    http.StatusInternalServerError,
			Message: "Lỗi khi cập nhật trạng thái file: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, UploadResponse{
		Code:    http.StatusOK,
		Message: "Cập nhật trạng thái file thành công",
	})
}
