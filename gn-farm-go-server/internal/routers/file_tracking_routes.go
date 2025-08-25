// Package routers - Chứa các routes để theo dõi và quản lý file trong hệ thống
package routers

import (
	"gn-farm-go-server/internal/service/file_tracking"

	"github.com/gin-gonic/gin"
)

// SetupFileTrackingRoutes - Thiết lập các routes liên quan đến theo dõi file
// Chức năng bao gồm:
// - Quản lý thống kê file và monitoring
// - Xóa file và batch operations
// - Theo dõi references của file
// - Dọn dẹp file temporary và orphaned
// - Audit logs cho các thao tác file
func SetupFileTrackingRoutes(
	// router - Instance của Gin engine để đăng ký routes
	router *gin.Engine,
	// fileTrackingHandler - Handler xử lý các yêu cầu theo dõi file
	fileTrackingHandler *file_tracking.FileTrackingHandler,
	// fileTrackingMiddleware - Middleware tự động theo dõi thay đổi file
	fileTrackingMiddleware *file_tracking.FileTrackingMiddleware,
	// cleanupMiddleware - Middleware xác thực và log cho các thao tác dọn dẹp
	cleanupMiddleware *file_tracking.CleanupMiddleware,
	// uploadMiddleware - Middleware theo dõi quá trình upload file
	uploadMiddleware *file_tracking.FileUploadMiddleware,
) {
	// Admin routes - Các routes dành cho admin quản lý file (có bảo mật)
	// Chỉ admin mới có quyền truy cập vào các chức năng này
	admin := router.Group("/api/admin")
	{
		// Áp dụng middleware xác thực cho các thao tác dọn dẹp
		admin.Use(cleanupMiddleware.RequireCleanupAuth())
		// Ghi log tất cả các thao tác dọn dẹp để audit
		admin.Use(cleanupMiddleware.LogCleanupOperation())
		
		// Nhóm routes quản lý file
		files := admin.Group("/files")
		{
			// Thống kê và giám sát file
			// GET /api/admin/files/statistics - Lấy thống kê tổng quan về file (số lượng, dung lượng, etc.)
			files.GET("/statistics", fileTrackingHandler.GetFileStatistics)
			// GET /api/admin/files/health - Kiểm tra sức khỏe của hệ thống file tracking
			files.GET("/health", fileTrackingHandler.GetHealthCheck)
			
			// Thông tin file cụ thể
			// GET /api/admin/files/:publicId - Lấy thông tin chi tiết của file theo publicId
			files.GET("/:publicId", fileTrackingHandler.GetFileInfo)
			
			// Audit logs - Nhật ký theo dõi các thao tác file
			// GET /api/admin/files/audit-logs - Xem lịch sử các thao tác file (upload, delete, modify)
			files.GET("/audit-logs", fileTrackingHandler.GetAuditLogs)
			
			// Thao tác file thủ công - Các chức năng xóa và quản lý file trực tiếp
			// DELETE /api/admin/files/:id - Xóa file cụ thể theo ID
			files.DELETE("/:id", fileTrackingHandler.DeleteFile)
			// POST /api/admin/files/batch-delete - Xóa nhiều file cùng lúc (batch operation)
			files.POST("/batch-delete", fileTrackingHandler.BatchDeleteFiles)
			
			// Quản lý file references - Theo dõi các tham chiếu đến file
			// POST /api/admin/files/:id/references - Thêm tham chiếu mới đến file
			files.POST("/:id/references", fileTrackingHandler.AddFileReference)
			// DELETE /api/admin/files/:id/references - Xóa tham chiếu đến file
			files.DELETE("/:id/references", fileTrackingHandler.RemoveFileReference)
			
			// Nhóm cleanup operations - Các chức năng dọn dẹp file tự động
			cleanup := files.Group("/cleanup")
			{
				// POST /api/admin/files/cleanup/temporary - Dọn dẹp các file tạm thời quá hạn
				cleanup.POST("/temporary", fileTrackingHandler.CleanupTemporaryFiles)
				// POST /api/admin/files/cleanup/orphaned - Dọn dẹp các file không còn được tham chiếu
				cleanup.POST("/orphaned", fileTrackingHandler.CleanupOrphanedFiles)
				// POST /api/admin/files/cleanup/schedule - Lên lịch các tác vụ dọn dẹp tự động
				cleanup.POST("/schedule", fileTrackingHandler.ScheduleCleanupJob)
			}
			
			// Thao tác với orphaned files - Quản lý file mồ côi
			// POST /api/admin/files/mark-orphaned - Đánh dấu các file không còn được sử dụng
			files.POST("/mark-orphaned", fileTrackingHandler.MarkOrphanedFiles)
		}
	}
	
	// Public API routes - Các API công khai với tự động theo dõi file
	// Tự động theo dõi và ghi nhận các thay đổi file khi có thao tác CRUD
	api := router.Group("/api")
	{
		// Áp dụng middleware theo dõi file cho các endpoints liên quan
		v1 := api.Group("/v1")
		// TrackFileChanges() middleware sẽ tự động ghi nhận mọi thay đổi file
		v1.Use(fileTrackingMiddleware.TrackFileChanges())
		{
			// Product routes với file tracking - Routes sản phẩm có theo dõi file
			// Tự động theo dõi khi sản phẩm có thêm/sửa/xóa ảnh hoặc file đính kèm
			products := v1.Group("/products")
			{
				// Các routes này sẽ tự động theo dõi thay đổi file
				// POST /api/v1/products - Tạo sản phẩm mới (auto-track file uploads)
				products.POST("/", /* your existing product create handler */)
				// PUT /api/v1/products/:id - Cập nhật sản phẩm (auto-track file changes)
				products.PUT("/:id", /* your existing product update handler */)
				// PATCH /api/v1/products/:id - Cập nhật một phần sản phẩm
				products.PATCH("/:id", /* your existing product update handler */)
				// DELETE /api/v1/products/:id - Xóa sản phẩm (auto-track file deletion)
				products.DELETE("/:id", /* your existing product delete handler */)
			}
			
			// User routes với file tracking - Routes người dùng có theo dõi file
			// Tự động theo dõi khi người dùng thay đổi avatar hoặc file cá nhân
			users := v1.Group("/users")
			{
				// PUT /api/v1/users/:id - Cập nhật thông tin người dùng
				users.PUT("/:id", /* your existing user update handler */)
				// PATCH /api/v1/users/:id - Cập nhật một phần thông tin người dùng
				users.PATCH("/:id", /* your existing user update handler */)
				// DELETE /api/v1/users/:id - Xóa tài khoản người dùng
				users.DELETE("/:id", /* your existing user delete handler */)
			}
			
			// Chat routes với file tracking - Routes chat có theo dõi file
			// Tự động theo dõi khi tin nhắn có đính kèm file, ảnh, video
			chat := v1.Group("/chat")
			{
				// POST /api/v1/chat/messages - Gửi tin nhắn mới (auto-track attached files)
				chat.POST("/messages", /* your existing chat message create handler */)
				// PUT /api/v1/chat/messages/:messageId - Cập nhật tin nhắn
				chat.PUT("/messages/:messageId", /* your existing chat message update handler */)
				// DELETE /api/v1/chat/messages/:messageId - Xóa tin nhắn và các file đính kèm
				chat.DELETE("/messages/:messageId", /* your existing chat message delete handler */)
			}
			
			// Inventory routes với file tracking - Routes kho hàng có theo dõi file
			// Tự động theo dõi khi phiếu nhập/xuất có đính kèm hình ảnh, chứng từ
			inventory := v1.Group("/inventory")
			{
				// POST /api/v1/inventory - Tạo phiếu nhập/xuất kho mới
				inventory.POST("/", /* your existing inventory create handler */)
				// PUT /api/v1/inventory/:id - Cập nhật phiếu kho
				inventory.PUT("/:id", /* your existing inventory update handler */)
				// DELETE /api/v1/inventory/:id - Xóa phiếu kho và các file liên quan
				inventory.DELETE("/:id", /* your existing inventory delete handler */)
			}
		}
		
		// Upload routes với file tracking - Nhóm routes upload có theo dõi
		// Tự động đăng ký và theo dõi tất cả các file được upload
		upload := api.Group("/upload")
		// TrackUpload() middleware ghi nhận thông tin file ngay khi upload thành công
		upload.Use(uploadMiddleware.TrackUpload())
		{
			// Các routes này sẽ tự động theo dõi file uploads
			// POST /api/upload/image - Upload ảnh (auto-track to database)
			upload.POST("/image", /* your existing image upload handler */)
			// POST /api/upload/file - Upload file tổng quát
			upload.POST("/file", /* your existing file upload handler */)
			// POST /api/upload/video - Upload video
			upload.POST("/video", /* your existing video upload handler */)
		}
	}
}

// SetupFileTrackingWebhooks - Thiết lập webhook để nhận sự kiện file từ các dịch vụ bên ngoài
// Xử lý các sự kiện từ Cloudinary, AWS S3 và các storage service khác
func SetupFileTrackingWebhooks(
	// router - Gin engine để đăng ký webhook endpoints
	router *gin.Engine,
	// fileTrackingHandler - Handler xử lý webhook events
	fileTrackingHandler *file_tracking.FileTrackingHandler,
) {
	// Nhóm webhooks cho các sự kiện file từ bên ngoài
	webhooks := router.Group("/webhooks")
	{
		// Cloudinary webhooks - Xử lý sự kiện từ Cloudinary
		// POST /webhooks/cloudinary/upload - Nhận thông báo khi upload file thành công
		webhooks.POST("/cloudinary/upload", handleCloudinaryUploadWebhook)
		// POST /webhooks/cloudinary/delete - Nhận thông báo khi xóa file
		webhooks.POST("/cloudinary/delete", handleCloudinaryDeleteWebhook)
		
		// S3 webhooks - Xử lý sự kiện từ AWS S3 (nếu sử dụng)
		// POST /webhooks/s3/upload - Nhận sự kiện S3 Object Created
		webhooks.POST("/s3/upload", handleS3UploadWebhook)
		// POST /webhooks/s3/delete - Nhận sự kiện S3 Object Deleted
		webhooks.POST("/s3/delete", handleS3DeleteWebhook)
	}
}

// handleCloudinaryUploadWebhook - Xử lý webhook upload từ Cloudinary
// Được gọi khi Cloudinary hoàn thành quá trình upload file
func handleCloudinaryUploadWebhook(c *gin.Context) {
	// Parse Cloudinary webhook payload
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(400, gin.H{"error": "Invalid payload"})
		return
	}
	
	// Extract file information from webhook
	// Variables commented out to avoid unused variable errors
	// publicID, _ := payload["public_id"].(string)
	// fileURL, _ := payload["secure_url"].(string)
	// fileName, _ := payload["original_filename"].(string)
	// fileType, _ := payload["resource_type"].(string)
	// fileSize, _ := payload["bytes"].(float64)
	
	// Store webhook data in context for upload middleware to process
	c.Set("upload_response", payload)
	
	c.JSON(200, gin.H{"status": "received"})
}

// handleCloudinaryDeleteWebhook handles Cloudinary delete webhooks
func handleCloudinaryDeleteWebhook(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(400, gin.H{"error": "Invalid payload"})
		return
	}
	
	// Handle file deletion
	publicID, _ := payload["public_id"].(string)
	if publicID != "" {
		// Mark file as deleted in tracking system
		// This would require access to the file service
		// For now, just log the event
		c.JSON(200, gin.H{"status": "received"})
	}
}

// handleS3UploadWebhook handles S3 upload webhooks
func handleS3UploadWebhook(c *gin.Context) {
	// Similar to Cloudinary but for S3 events
	c.JSON(200, gin.H{"status": "received"})
}

// handleS3DeleteWebhook handles S3 delete webhooks
func handleS3DeleteWebhook(c *gin.Context) {
	// Similar to Cloudinary but for S3 events
	c.JSON(200, gin.H{"status": "received"})
}

// SetupFileTrackingCronJobs sets up cron jobs for scheduled cleanup
func SetupFileTrackingCronJobs(
	fileService file_tracking.FileTrackingService,
	scheduler *file_tracking.CleanupScheduler,
) {
	// This would typically use a cron library like github.com/robfig/cron
	// For now, we'll just document the intended schedule
	
	// Example cron schedules:
	// - Cleanup temporary files: every 6 hours
	// - Cleanup orphaned files: every day at 2 AM
	// - Mark orphaned files: every hour
	// - Generate statistics: every 30 minutes
	
	// Implementation would look like:
	// c := cron.New()
	// c.AddFunc("0 */6 * * *", func() {
	//     ctx := context.Background()
	//     fileService.CleanupTemporaryFiles(ctx, 24*time.Hour)
	// })
	// c.AddFunc("0 2 * * *", func() {
	//     ctx := context.Background()
	//     fileService.CleanupOrphanedFiles(ctx, 7*24*time.Hour)
	// })
	// c.AddFunc("0 * * * *", func() {
	//     ctx := context.Background()
	//     fileService.MarkOrphanedFiles(ctx)
	// })
	// c.Start()
}

// FileTrackingRouteConfig contains configuration for file tracking routes
type FileTrackingRouteConfig struct {
	EnableWebhooks     bool
	EnableCronJobs     bool
	EnableAdminRoutes  bool
	EnableMiddleware   bool
	CleanupAPIKey      string
	WebhookSecret      string
}

// SetupFileTrackingWithConfig sets up file tracking with configuration
func SetupFileTrackingWithConfig(
	router *gin.Engine,
	config FileTrackingRouteConfig,
	fileTrackingHandler *file_tracking.FileTrackingHandler,
	fileTrackingMiddleware *file_tracking.FileTrackingMiddleware,
	cleanupMiddleware *file_tracking.CleanupMiddleware,
	uploadMiddleware *file_tracking.FileUploadMiddleware,
	fileService file_tracking.FileTrackingService,
	scheduler *file_tracking.CleanupScheduler,
) {
	// Setup admin routes if enabled
	if config.EnableAdminRoutes {
		SetupFileTrackingRoutes(
			router,
			fileTrackingHandler,
			fileTrackingMiddleware,
			cleanupMiddleware,
			uploadMiddleware,
		)
	}
	
	// Setup webhooks if enabled
	if config.EnableWebhooks {
		SetupFileTrackingWebhooks(router, fileTrackingHandler)
	}
	
	// Setup cron jobs if enabled
	if config.EnableCronJobs {
		SetupFileTrackingCronJobs(fileService, scheduler)
	}
}

// Example usage in main router setup:
// func SetupRoutes(router *gin.Engine, deps *Dependencies) {
//     // ... other route setups ...
//     
//     // Setup file tracking
//     config := FileTrackingRouteConfig{
//         EnableWebhooks:    true,
//         EnableCronJobs:    true,
//         EnableAdminRoutes: true,
//         EnableMiddleware:  true,
//         CleanupAPIKey:     os.Getenv("CLEANUP_API_KEY"),
//         WebhookSecret:     os.Getenv("WEBHOOK_SECRET"),
//     }
//     
//     SetupFileTrackingWithConfig(
//         router,
//         config,
//         deps.FileTrackingHandler,
//         deps.FileTrackingMiddleware,
//         deps.CleanupMiddleware,
//         deps.UploadMiddleware,
//         deps.FileService,
//         deps.CleanupScheduler,
//     )
// }