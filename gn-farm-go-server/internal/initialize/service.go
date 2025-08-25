//####################################################################
// SERVICE INTERFACE INITIALIZATION - KHỞI TẠO CÁC SERVICE INTERFACE
// Package này chịu trách nhiệm khởi tạo các service interface cho hệ thống
// 
// Chức năng chính:
// - Khởi tạo user authentication services
// - Thiết lập file tracking service cho quản lý file uploads
// - Khởi tạo upload service cho Cloudinary integration
// - Dependency injection giữa các services
// - Error handling và service validation
//
// Service interfaces bao gồm:
// - UserAuth: Xác thực và phân quyền người dùng
// - FileTracking: Theo dõi và quản lý file uploads
// - Upload: Upload files lên cloud storage (Cloudinary)
// - Service dependency injection và configuration
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

package initialize

import (
	"gn-farm-go-server/global"
	"gn-farm-go-server/internal/config"
	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service"
	"gn-farm-go-server/internal/service/upload"
	"gn-farm-go-server/internal/wire"
	"go.uber.org/zap"
)

// ===== KHỞI TẠO TẤT CẢ SERVICE INTERFACES =====
// InitServiceInterface khởi tạo tất cả service interfaces của hệ thống
// Theo thứ tự dependency để đảm bảo các services được khởi tạo đúng cách
func InitServiceInterface() {
	// ===== KHỞI TẠO USER AUTHENTICATION SERVICE =====
	// Khởi tạo service xác thực người dùng với Wire dependency injection
	userAuth, err := wire.InitUserAuthService()
	if err != nil {
		// Panic nếu không thể khởi tạo user auth - critical service
		panic(err)
	}
	// Đăng ký user auth service vào global service registry
	service.InitUserAuth(userAuth)
	
	// ===== KHỞI TẠO FILE TRACKING SERVICE =====
	// File tracking service phải được khởi tạo trước upload service
	// Vì upload service có dependency vào file tracking
	db := database.New(global.Pgdbc)
	fileTrackingService, err := wire.InitFileTrackingService(db)
	if err != nil {
		global.Logger.Error("Failed to initialize file tracking service", zap.Error(err))
		panic(err)
	}
	// Đăng ký file tracking service vào global service registry
	service.SetFileTrackingService(fileTrackingService)

	// ===== KHỞI TẠO UPLOAD SERVICE =====
	// Khởi tạo service upload files lên Cloudinary cloud storage
	uploadService, err := wire.InitUploadService()
	if err != nil {
		global.Logger.Error("Failed to initialize upload service", zap.Error(err))
		panic(err)
	}
	// Đăng ký upload service vào global service registry
	service.SetUploadService(uploadService)

	// ===== DEPENDENCY INJECTION GIỮA SERVICES =====
	// Inject file tracking service vào upload service để theo dõi uploaded files
	if cloudinaryService, ok := uploadService.(*upload.CloudinaryService); ok {
		// Tạo adapter để connect file tracking service với upload service
		adapter := config.NewFileTrackingServiceAdapter(fileTrackingService)
		// Inject adapter vào Cloudinary service
		cloudinaryService.SetFileTrackingService(adapter)
		global.Logger.Info("File tracking service injected into upload service")
	}

	// ===== KHỞI TẠO SALES SERVICE =====
	// Khởi tạo service quản lý bán hàng
	InitSalesService()
}
