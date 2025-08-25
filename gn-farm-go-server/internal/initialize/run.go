//####################################################################
// APPLICATION RUNNER - KHỞI TẠO VÀ CHẠY ỨNG DỤNG
// Package này chịu trách nhiệm khởi tạo và cấu hình toàn bộ hệ thống
// 
// Chức năng chính:
// - Tải cấu hình hệ thống từ config files
// - Khởi tạo logger, database connections (PostgreSQL, Redis)
// - Thiết lập message queue (Kafka) và external services
// - Khởi tạo các business services (Product, Inventory, User)
// - Cấu hình file tracking và background services
// - Trả về Gin router đã được cấu hình hoàn chỉnh
//
// Thứ tự khởi tạo quan trọng:
// 1. LoadConfig -> Logger -> Database -> Services -> Router
// 2. Background services chạy bất đồng bộ trong goroutines
// 3. File tracking scheduler cho cleanup tự động
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

// Package initialize chứa các hàm khởi tạo hệ thống
package initialize

import (
	"context"
	"fmt"
	"time"

	"gn-farm-go-server/global"            // Các biến toàn cục
	"gn-farm-go-server/internal/config"   // Cấu hình hệ thống
	"gn-farm-go-server/internal/database" // Kết nối database

	"github.com/gin-gonic/gin" // Web framework
	"go.uber.org/zap"          // Logging library
)

// ===== HÀM CHÍNH CHẠY ỨNG DỤNG =====
// Hàm Run khởi tạo và cấu hình toàn bộ hệ thống
// Trả về Gin router đã được cấu hình đầy đủ
func Run() *gin.Engine {
	// ===== BƯỚC 1: TẢI CẤU HÌNH HỆ THỐNG =====
	// Tải cấu hình từ file config (yaml/json) và environment variables
	LoadConfig()
	m := global.Config.Postgres
	fmt.Println("Loading configuration nysql", m.Username, m.Password)
	
	// ===== BƯỚC 2: KHỞI TẠO CÁC THÀNH PHẦN HỆ THỐNG =====
	// Khởi tạo các thành phần theo thứ tự dependency
	
	// Khởi tạo logger trước tiên để có thể log các bước tiếp theo
	InitLogger()        // Hệ thống logging với Zap
	global.Logger.Info("Config Log ok!!", zap.String("ok", "success"))
	
	// Khởi tạo các kết nối database
	InitPostgres()      // Kết nối PostgreSQL chính (GORM)
	InitPostgresC()     // Kết nối PostgreSQL phụ (raw SQL cho SQLC)
	
	// Khởi tạo các service interfaces và business logic
	InitServiceInterface() // Khởi tạo các service interface
	InitProductService()   // Service quản lý sản phẩm (Mushroom, Vegetable, Bonsai)
	InitInventoryService() // Service quản lý tồn kho và FIFO
	InitSalesService()     // Service quản lý bán hàng và phiếu bán
	
	// Khởi tạo các external services
	InitRedis()         // Kết nối Redis cache cho session và caching
	InitKafka()         // Kết nối Kafka message queue cho OTP và events

	// ===== BƯỚC 3: KHỞI TẠO FILE TRACKING SYSTEM =====
	// Tạo context cho toàn bộ vòng đời ứng dụng
	ctx := context.Background()

	// ===== KHỞI TẠO FILE TRACKING SERVICE VÀ SCHEDULER =====
	// Chạy bất đồng bộ để không block main thread
	initFileTracking(ctx)

	// ===== BƯỚC 4: KHỞI TẠO VÀ TRẢ VỀ ROUTER =====
	// Khởi tạo và cấu hình router với tất cả routes và middlewares
	r := InitRouter()
	return r
}

// ===== KHỞI TẠO HỆ THỐNG FILE TRACKING =====
// initFileTracking khởi tạo hệ thống theo dõi và dọn dẹp file
// Chạy ở chế độ bất đồng bộ để không block main thread
func initFileTracking(ctx context.Context) {
	// ===== LẤY CẤU HÌNH MẶC ĐỊNH =====
	// Lấy cấu hình mặc định cho file tracking
	fileTrackingConfig := config.GetDefaultFileTrackingConfig()
	
	// ===== CẬP NHẬT CẤU HÌNH CHO DEVELOPMENT =====
	// Cập nhật cấu hình cho việc test và development
	fileTrackingConfig.Cleanup.Scheduled.Enabled = true                    // Bật tính năng dọn dẹp tự động
	fileTrackingConfig.Cleanup.Scheduled.Interval = 1 * time.Minute       // Chạy mỗi phút để test
	fileTrackingConfig.Cleanup.Temporary.MaxAge = 3 * time.Minute         // Xóa file tạm sau 3 phút
	
	// Ghi log cấu hình đã được cập nhật
	global.Logger.Info("[INIT] File tracking config updated for testing",
		zap.Bool("cleanup_scheduled_enabled", fileTrackingConfig.Cleanup.Scheduled.Enabled),
		zap.Duration("cleanup_interval", fileTrackingConfig.Cleanup.Scheduled.Interval),
		zap.Duration("temp_file_max_age", fileTrackingConfig.Cleanup.Temporary.MaxAge),
	)

	// ===== KHỞI TẠO DEPENDENCIES =====
	// Khởi tạo dependencies với database connection thực
	global.Logger.Info("[INIT] Setting up file tracking dependencies...")
	db := database.New(global.Pgdbc)  // Tạo SQLC queries instance
	deps, err := config.SetupFileTrackingDependencies(
		fileTrackingConfig,
		db,            // SQLC database queries
		global.Pgdbc,  // Raw SQL database connection
		global.Rdb,    // Redis client cho caching
	)
	if err != nil {
		global.Logger.Error("[INIT] Failed to setup file tracking dependencies", zap.Error(err))
		return
	}
	global.Logger.Info("[INIT] File tracking dependencies setup completed",
		zap.Bool("has_cleanup_scheduler", deps.CleanupScheduler != nil),
	)

	// ===== KHỚI ĐỘNG BACKGROUND SERVICES =====
	// Sử dụng context.Background() để tạo một context mới không bị cancel
	bgCtx := context.Background()
	
	// Khởi động các service trong goroutine riêng để chạy bất đồng bộ
	global.Logger.Info("[INIT] Starting file tracking services in background...")
	go func() {
		global.Logger.Info("[INIT] Inside goroutine - about to start file tracking services")
		// Bắt đầu các file tracking services (cleanup scheduler, etc.)
		if err := config.StartFileTrackingServices(bgCtx, fileTrackingConfig, deps); err != nil {
			global.Logger.Error("[INIT] Failed to start file tracking services", zap.Error(err))
			return
		}
		global.Logger.Info("[INIT] File tracking services started successfully in goroutine")
	}()

	// ===== GHI LOG KẾT QUẢ KHỞI TẠO =====
	global.Logger.Info("[INIT] File tracking initialization completed", 
		zap.Duration("cleanup_interval", fileTrackingConfig.Cleanup.Scheduled.Interval),
		zap.Duration("temp_file_max_age", fileTrackingConfig.Cleanup.Temporary.MaxAge),
		zap.String("note", "Services are starting in background goroutine"),
	)
}
