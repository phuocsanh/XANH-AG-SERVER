// Package routers - Chứa các router để quản lý upload file
package routers

import (
	"gn-farm-go-server/internal/controller/upload"
	"gn-farm-go-server/internal/middlewares"
	"gn-farm-go-server/internal/service"
	"gn-farm-go-server/internal/service/file_tracking"

	"github.com/gin-gonic/gin"
)

// UploadRouter - Cấu trúc quản lý các route liên quan đến upload file
// Tích hợp với file tracking để theo dõi và quản lý vong đời của file
type UploadRouter struct {
	// UploadHandler - Xử lý các yêu cầu upload file lên cloud storage (Cloudinary/S3)
	UploadHandler upload.UploadHandler
	// FileUploadMiddleware - Middleware tự động track file uploads vào database
	// Ghi nhận thông tin file, quản lý references và lifecycle
	FileUploadMiddleware *file_tracking.FileUploadMiddleware
}

// NewUploadRouter - Tạo một instance mới của UploadRouter với các dependencies cần thiết
// Khởi tạo router với upload handler và file tracking middleware
func NewUploadRouter(uploadHandler upload.UploadHandler, fileUploadMiddleware *file_tracking.FileUploadMiddleware) *UploadRouter {
	return &UploadRouter{
		UploadHandler: uploadHandler,
		FileUploadMiddleware: fileUploadMiddleware,
	}
}

// InitRouter - Khởi tạo và đăng ký tất cả các route cho chức năng upload
// Tạo nhóm API endpoints cho upload file với các chức năng:
// - Upload file mới với tracking
// - Xóa file (cần authentication)
// - Đánh dấu file đã sử dụng (cần authentication)
func (r *UploadRouter) InitRouter(router *gin.RouterGroup) {
	// Nhóm các API upload file - Tất cả endpoints dưới /uploads
	uploadGroup := router.Group("/uploads")
	{
		// POST /uploads - API upload file với file tracking middleware
		// FileUploadMiddleware.TrackUpload() tự động ghi thông tin file vào database
		// Bao gồm: file metadata, upload timestamp, initial status
		uploadGroup.POST("", r.FileUploadMiddleware.TrackUpload(), r.UploadHandler.UploadFile)
		
		// DELETE /uploads/:public_id - API xóa file theo public_id
		// Cần JWT authentication để bảo mật
		// Xóa file từ cloud storage và cập nhật database
		uploadGroup.DELETE("/:public_id", middlewares.JWTAuth(), r.UploadHandler.DeleteFile)
		
		// PUT /uploads/:public_id/mark-used - API đánh dấu file đã được sử dụng
		// Cần JWT authentication để bảo mật
		// Chuyển file từ trạng thái temporary sang permanent
		uploadGroup.PUT("/:public_id/mark-used", middlewares.JWTAuth(), r.UploadHandler.MarkFileAsUsed)
	}
}

// UploadRouterGroup - Instance toàn cục quản lý nhóm upload router
// Cung cấp interface để khởi tạo upload routes trong hệ thống routing chính
var UploadRouterGroup = new(uploadRouterGroup)

// uploadRouterGroup - Struct implement interface cho UploadRouterGroup
type uploadRouterGroup struct{}

// InitUploadRouter - Khởi tạo toàn bộ hệ thống upload router với dependencies
// Tự động tạo và inject các dependencies cần thiết:
// - Upload service từ service layer
// - File tracking service và helper
// - File upload middleware cho auto-tracking
func (u *uploadRouterGroup) InitUploadRouter(router *gin.RouterGroup) {
	// Tạo upload handler từ service layer
	// service.Upload() trả về configured upload service (Cloudinary/S3)
	uploadHandler := upload.NewUploadHandler(service.Upload())
	
	// Tạo các file tracking dependencies để theo dõi file lifecycle
	// FileTracking service quản lý database operations cho file metadata
	fileTrackingService := service.FileTracking()
	// Helper cung cấp các utility functions cho file tracking
	fileTrackingHelper := file_tracking.NewFileTrackingHelper(fileTrackingService)
	// Middleware tự động track file uploads vào database
	fileUploadMiddleware := file_tracking.NewFileUploadMiddleware(fileTrackingHelper)
	
	// Khởi tạo và đăng ký upload router với đầy đủ dependencies
	uploadRouter := NewUploadRouter(uploadHandler, fileUploadMiddleware)
	uploadRouter.InitRouter(router)
}
