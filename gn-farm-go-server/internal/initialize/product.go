//####################################################################
// PRODUCT SERVICE INITIALIZATION - KHỞI TẠO CÁC DỊCH VỤ SẢN PHẨM
// Package này chịu trách nhiệm khởi tạo tất cả các product services
// 
// Chức năng chính:
// - Khởi tạo SQLC database queries cho product operations
// - Thiết lập dependency injection với Wire framework
// - Khởi tạo các product services: Mushroom, Vegetable, Bonsai
// - Khởi tạo product type và subtype services
// - Thiết lập product relationships và categorization
//
// Product system quản lý:
// - Sản phẩm nấm (Mushroom products)
// - Sản phẩm rau củ (Vegetable products)  
// - Sản phẩm cây cảnh (Bonsai products)
// - Phân loại sản phẩm (Product types và subtypes)
// - Mối quan hệ giữa các loại sản phẩm
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

package initialize

import (
	"gn-farm-go-server/global"
	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service"
	"gn-farm-go-server/internal/wire"
)

// ===== KHỞI TẠO TẤT CẢ PRODUCT SERVICES =====
// InitProductService khởi tạo toàn bộ hệ thống quản lý sản phẩm
// Bao gồm các service cho từng loại sản phẩm và phân loại sản phẩm
func InitProductService() {
	// ===== TẠO SQLC QUERIES INSTANCE =====
	// Khởi tạo SQLC queries với raw PostgreSQL connection
	// Được sử dụng cho tất cả product database operations
	queries := database.New(global.Pgdbc)

	// ===== KHỞI TẠO CÁC PRODUCT SERVICES =====
	// Khởi tạo service chung cho tất cả sản phẩm
	service.InitProductService(wire.InitializeProductService(queries))
	
	// Khởi tạo service quản lý sản phẩm nấm (Mushroom)
	// Bao gồm: cultivation, harvesting, packaging, quality control
	service.InitMushroomService(wire.InitializeMushroomService(queries))
	
	// Khởi tạo service quản lý sản phẩm rau củ (Vegetable) 
	// Bao gồm: planting, growing, harvesting, post-harvest processing
	service.InitVegetableService(wire.InitializeVegetableService(queries))
	
	// Khởi tạo service quản lý cây cảnh (Bonsai)
	// Bao gồm: cultivation, styling, maintenance, sales
	service.InitBonsaiService(wire.InitializeBonsaiService(queries))

	// ===== KHỞI TẠO PRODUCT TYPE SERVICES =====
	// Service quản lý các loại sản phẩm chính (Product Types)
	// VD: Nấm, Rau củ, Cây cảnh, Phân bón, etc.
	service.ProductType = wire.InitializeProductTypeService(queries)
	
	// Service quản lý các loại sản phẩm phụ (Product Subtypes)
	// VD: Nấm kim châm, Nấm bào ngư, Rau xà lách, Cây lưỡi hổ, etc.
	service.ProductSubtype = wire.InitializeProductSubtypeService(queries)
	
	// Service quản lý mối quan hệ giữa product types và subtypes
	// Thiết lập hierarchy và categorization cho sản phẩm
	service.ProductSubtypeRelation = wire.InitializeProductSubtypeRelationService(queries)
}