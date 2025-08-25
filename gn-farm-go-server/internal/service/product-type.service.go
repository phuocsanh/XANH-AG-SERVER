// Package service - Định nghĩa các interface cho product type management
// Quản lý các loại sản phẩm, loại phụ và mối quan hệ giữa chúng
package service

import (
	"context"                               // Context cho operations có thể timeout/cancel
	"gn-farm-go-server/internal/database"   // Database models
	"gn-farm-go-server/internal/vo/product" // Product value objects
)

// IProductTypeService - Interface chính cho quản lý loại sản phẩm
// Theo pattern mới với response codes và error handling chuẩn
type IProductTypeService interface {
	// GetProductType - Lấy thông tin chi tiết loại sản phẩm theo ID
	GetProductType(ctx context.Context, id int32) (codeResult int, out product.ProductTypeResponse, err error)
	
	// ListProductTypes - Lấy danh sách tất cả loại sản phẩm
	ListProductTypes(ctx context.Context) (codeResult int, out []product.ProductTypeResponse, err error)
	
	// CreateProductType - Tạo loại sản phẩm mới
	CreateProductType(ctx context.Context, req *product.ProductTypeRequest) (codeResult int, out product.ProductTypeResponse, err error)
	
	// UpdateProductType - Cập nhật thông tin loại sản phẩm
	UpdateProductType(ctx context.Context, id int32, req *product.ProductTypeRequest) (codeResult int, out product.ProductTypeResponse, err error)
	
	// DeleteProductType - Xóa loại sản phẩm
	DeleteProductType(ctx context.Context, id int32) (codeResult int, err error)
}

// ProductTypeService - Legacy interface cho backward compatibility
// Giữ lại để tương thích với code hiện tại, sẽ được thay thế bằng IProductTypeService
type ProductTypeService interface {
	// GetProductType - Lấy thông tin chi tiết loại sản phẩm theo ID (legacy)
	GetProductType(ctx context.Context, id int32) (codeResult int, out product.ProductTypeResponse, err error)
	
	// ListProductTypes - Lấy danh sách tất cả loại sản phẩm (legacy)
	ListProductTypes(ctx context.Context) (codeResult int, out []product.ProductTypeResponse, err error)
	
	// CreateProductType - Tạo loại sản phẩm mới (legacy)
	CreateProductType(ctx context.Context, req *product.ProductTypeRequest) (codeResult int, out product.ProductTypeResponse, err error)
	
	// UpdateProductType - Cập nhật thông tin loại sản phẩm (legacy)
	UpdateProductType(ctx context.Context, id int32, req *product.ProductTypeRequest) (codeResult int, out product.ProductTypeResponse, err error)
	
	// DeleteProductType - Xóa loại sản phẩm (legacy)
	DeleteProductType(ctx context.Context, id int32) (codeResult int, err error)
}

// ProductSubtypeService - Interface quản lý loại phụ của sản phẩm
// Xử lý các operations liên quan đến subtype và mapping với product types
type ProductSubtypeService interface {
	// GetProductSubtype - Lấy thông tin chi tiết loại phụ theo ID
	GetProductSubtype(ctx context.Context, id int32) (*database.ProductSubtype, error)
	
	// ListProductSubtypes - Lấy danh sách tất cả loại phụ
	ListProductSubtypes(ctx context.Context) ([]database.ProductSubtype, error)
	
	// ListProductSubtypesByType - Lấy danh sách loại phụ theo loại sản phẩm chính
	ListProductSubtypesByType(ctx context.Context, productTypeID int32) ([]database.ProductSubtype, error)
	
	// CreateProductSubtype - Tạo loại phụ sản phẩm mới
	CreateProductSubtype(ctx context.Context, name, description string) (*database.ProductSubtype, error)
	
	// UpdateProductSubtype - Cập nhật thông tin loại phụ
	UpdateProductSubtype(ctx context.Context, id int32, name, description string) (*database.ProductSubtype, error)
	
	// DeleteProductSubtype - Xóa loại phụ
	DeleteProductSubtype(ctx context.Context, id int32) error
	
	// AddProductSubtypeMapping - Thêm mối quan hệ giữa product type và subtype
	AddProductSubtypeMapping(ctx context.Context, productTypeID, productSubtypeID int32) error
	
	// RemoveProductSubtypeMapping - Xóa mối quan hệ giữa product type và subtype
	RemoveProductSubtypeMapping(ctx context.Context, productTypeID, productSubtypeID int32) error
}

// ProductSubtypeRelationService - Interface quản lý mối quan hệ giữa sản phẩm và loại phụ
// Xử lý mapping cụ thể giữa từng sản phẩm với các subtype
type ProductSubtypeRelationService interface {
	// GetProductSubtypeRelations - Lấy tất cả mối quan hệ subtype của sản phẩm
	GetProductSubtypeRelations(ctx context.Context, productID int32) ([]*database.GetProductSubtypeRelationsRow, error)
	
	// AddProductSubtypeRelation - Thêm mối quan hệ giữa sản phẩm và subtype
	AddProductSubtypeRelation(ctx context.Context, productID, productSubtypeID int32) error
	
	// RemoveProductSubtypeRelation - Xóa một mối quan hệ cụ thể
	RemoveProductSubtypeRelation(ctx context.Context, productID, productSubtypeID int32) error
	
	// RemoveAllProductSubtypeRelations - Xóa tất cả mối quan hệ subtype của sản phẩm
	RemoveAllProductSubtypeRelations(ctx context.Context, productID int32) error
}

// Các biến toàn cục lưu trữ singleton instances của các services
// Sử dụng dependency injection pattern
var (
	ProductType           ProductTypeService           // Service quản lý loại sản phẩm
	ProductSubtype        ProductSubtypeService        // Service quản lý loại phụ
	ProductSubtypeRelation ProductSubtypeRelationService // Service quản lý mối quan hệ subtype
)
