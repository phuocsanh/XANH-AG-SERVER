//####################################################################
// ROUTER INITIALIZATION - KHỞI TẠO HỆ THỐNG ROUTING
// Package này chịu trách nhiệm khởi tạo và cấu hình Gin router
// 
// Chức năng chính:
// - Khởi tạo Gin engine với chế độ phù hợp
// - Cấu hình middlewares: CORS, logging, error handling
// - Thiết lập static file serving cho uploads
// - Đăng ký các router groups: Manage, User, Product
// - Khởi tạo upload handlers và file tracking
// - Thiết lập API versioning và health check endpoints
//
// Router architecture:
// - API v1: /api/v1/* (các API endpoints chính)
// - Health: /health (kiểm tra tình trạng hệ thống)
// - Static: /uploads/* (phục vụ file uploads)
// - CORS: Hỗ trợ cross-origin requests
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

package initialize

import (
	"gn-farm-go-server/global"
	"gn-farm-go-server/internal/controller/health"
	"gn-farm-go-server/internal/controller/upload"
	"gn-farm-go-server/internal/middlewares"
	"gn-farm-go-server/internal/routers"
	"gn-farm-go-server/internal/service"
	"gn-farm-go-server/internal/service/file_tracking"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// ===== KHỞI TẠO GIN ROUTER CHÍNH =====
// InitRouter khởi tạo và cấu hình Gin router cho toàn bộ ứng dụng
// Trả về Gin engine đã được cấu hình đầy đủ
func InitRouter() *gin.Engine {
	// ===== KHỞI TẠO GIN ENGINE =====
	var r *gin.Engine
	if global.Config.Server.Mode == "dev" {
		// Chế độ development: debug mode với console colors
		gin.SetMode(gin.DebugMode)
		gin.ForceConsoleColor()  // Bắt màu sắc trong console logs
		r = gin.Default()        // Sử dụng default middlewares (Logger, Recovery)
	} else {
		// Chế độ production: release mode không có debug info
		gin.SetMode(gin.ReleaseMode)
		r = gin.New()            // Không sử dụng default middlewares
	}

	// ===== CẤU HÌNH STATIC FILE SERVING =====
	// Phục vụ các file uploads từ thư mục ./uploads
	r.Static("/uploads", "./uploads") 
	// Giới hạn kích thước file upload tối đa 8MB
	r.MaxMultipartMemory = 8 << 20 // 8 MiB
	
	// ===== ĐĂNG KÝ MIDDLEWARES =====
	// Xử lý lỗi toàn cục
	r.Use(middlewares.ErrorHandler())
	// Logging các HTTP requests
	r.Use(middlewares.LoggingMiddleware())
	// Log chi tiết request và response
	r.Use(middlewares.RequestResponseLoggingMiddleware())
	
	// ===== CẤU HÌNH CORS MIDDLEWARE =====
	// Cho phép cross-origin requests từ mọi domain
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},                                        // Cho phép tất cả origins
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}, // Các HTTP methods được phép
		AllowHeaders:     []string{"*"},                                        // Cho phép tất cả headers
		ExposeHeaders:    []string{"Content-Length"},                          // Expose Content-Length header
		AllowCredentials: false,                                              // Không cho phép gửi credentials
	}))

	// ===== KHỞI TẠO CÁC ROUTER GROUPS =====
	// Lấy các router group instances từ RouterGroupApp
	manageRouter := routers.RouterGroupApp.Manage        // Quản lý admin và staff
	userRouterGroup := routers.RouterGroupApp.User       // Người dùng cuối
	productRouterGroup := routers.RouterGroupApp.Product // Sản phẩm và inventory

	// ===== KHỞI TẠO UPLOAD HANDLER VỚI FILE TRACKING =====
	// Tạo upload handler với Cloudinary service
	uploadHandler := upload.NewUploadHandler(service.Upload())
	
	// Thiết lập file tracking dependencies để theo dõi uploaded files
	fileTrackingService := service.FileTracking()  // Lấy file tracking service
	fileTrackingHelper := file_tracking.NewFileTrackingHelper(fileTrackingService)  // Helper utilities
	fileUploadMiddleware := file_tracking.NewFileUploadMiddleware(fileTrackingHelper)  // Middleware để track uploads
	
	// Tạo upload router với file tracking middleware
	uploadRouter := routers.NewUploadRouter(uploadHandler, fileUploadMiddleware)

	// ===== HEALTH CHECK ENDPOINTS (BÊN NGOÀI API VERSIONING) =====
	// Các endpoints kiểm tra tình trạng hệ thống
	r.GET("/health", health.Health.HealthCheck)      // Tổng quan tình trạng hệ thống
	r.GET("/ready", health.Health.ReadinessCheck)    // Kiểm tra sẵn sàng nhận requests
	r.GET("/live", health.Health.LivenessCheck)      // Kiểm tra ứng dụng còn sống

	// ===== API V1 GROUP - CÁC ENDPOINTS CHÍNH =====
	v1 := r.Group("/v1")  // Nhóm API version 1
	{
		// ===== HEALTH CHECK TRONG API V1 =====
		v1.GET("/checkStatus", health.Health.HealthCheck)

		// ===== ĐĂNG KÝ CÁC ROUTER GROUPS =====
		// User routes - Đăng ký, đăng nhập, profile, etc.
		userRouterGroup.InitUserRouter(v1)

		// Product routes - Xem sản phẩm, tìm kiếm, chi tiết sản phẩm
		productRouterGroup.InitProductRouter(v1)

		// Manage routes - Quản lý dành cho admin và staff
		manageRouter.InitUserRouter(v1)           // Quản lý người dùng
		manageRouter.InitAdminRouter(v1)          // Quản lý admin functions
		manageRouter.InitInventoryManageRouter(v1) // Quản lý inventory/kho
		manageRouter.InitProductManageRouter(v1)   // Quản lý sản phẩm
		manageRouter.InitSalesManageRouter(v1)     // Quản lý bán hàng

		// Upload routes - Upload files và quản lý media
		uploadRouter.InitRouter(v1)
	}

	// Trả về Gin engine đã được cấu hình hoàn chỉnh
	return r
}
