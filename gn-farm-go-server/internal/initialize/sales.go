package initialize

import (
	"gn-farm-go-server/global"
	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service"
	"gn-farm-go-server/internal/wire"
)

// InitSalesService khởi tạo sales service với Wire dependency injection
func InitSalesService() {
	// ===== KHỞI TẠO SALES SERVICE =====
	// Khởi tạo service quản lý bán hàng với Wire dependency injection
	db := database.New(global.Pgdbc)
	salesService := wire.InitializeSalesService(db)
	
	// Đăng ký sales service vào global service registry
	service.InitSalesService(salesService)
	
	global.Logger.Info("Sales service initialized successfully")
}