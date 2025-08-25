//####################################################################
// INVENTORY SERVICE INITIALIZATION - KHỞI TẠO DỊCH VỤ QUẢN LÝ KHO
// Package này chịu trách nhiệm khởi tạo inventory service và controller
// 
// Chức năng chính:
// - Khởi tạo SQLC database queries cho inventory operations
// - Thiết lập dependency injection với Wire framework
// - Khởi tạo inventory controller với các dependencies
// - Lưu controller instance vào global variables
//
// Inventory system quản lý:
// - Tồn kho sản phẩm theo FIFO
// - Giá vốn trung bình gia quyền (weighted average costing)
// - Giao dịch nhập/xuất kho
// - Báo cáo inventory và analytics
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

package initialize

import (
	"gn-farm-go-server/global"
	"gn-farm-go-server/internal/controller/inventory"
	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/wire"
)

// ===== KHỞI TẠO INVENTORY SERVICE =====
// InitInventoryService khởi tạo inventory service với dependency injection
// Sử dụng Wire framework để tự động inject các dependencies
func InitInventoryService() {
	// ===== TẠO SQLC QUERIES INSTANCE =====
	// Khởi tạo SQLC queries với raw PostgreSQL connection
	queries := database.New(global.Pgdbc)

	// ===== DEPENDENCY INJECTION VỚI WIRE =====
	// Sử dụng Wire để tự động inject dependencies vào inventory controller
	// Wire sẽ tự động wire: queries -> service -> controller
	inventoryController := wire.InitializeInventoryController(queries)
	
	// ===== LƯU CONTROLLER VÀO GLOBAL =====
	// Lưu controller instance để sử dụng trong routes
	inventory.Inventory = inventoryController
}
