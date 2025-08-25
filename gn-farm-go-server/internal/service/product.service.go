// Package service - Định nghĩa các interface cho product management và business logic
// Quản lý tất cả các chức năng liên quan đến sản phẩm nông trại
package service

import (
	"context"       // Context cho operations có thể timeout/cancel
	"database/sql"  // SQL database types
	"encoding/json" // JSON encoding/decoding
	"fmt"           // String formatting

	"gn-farm-go-server/internal/database"   // Database models
	"gn-farm-go-server/internal/model"      // Common data models
	"gn-farm-go-server/internal/vo/product" // Product value objects
)

// IProductService - Interface chính cho quản lý sản phẩm
// Cung cấp đầy đủ các chức năng CRUD, tìm kiếm, lọc, và thống kê
type IProductService interface {
	// CreateProduct - Tạo sản phẩm mới với thông tin chi tiết
	CreateProduct(ctx context.Context, in *product.CreateProductRequest) (codeResult int, out product.ProductResponse, err error)
	
	// GetProduct - Lấy thông tin chi tiết sản phẩm theo ID
	GetProduct(ctx context.Context, id int32) (codeResult int, out product.ProductResponse, err error)
	
	// ListProducts - Lấy danh sách sản phẩm với phân trang
	ListProducts(ctx context.Context, input *model.PaginationRequest) (codeResult int, out *model.PaginatedResponse[product.ProductResponse], err error)
	
	// ListProductsWithFilter - Lấy danh sách sản phẩm có lọc theo loại và loại phụ
	ListProductsWithFilter(ctx context.Context, productType *int32, subProductType *int32, input *model.PaginationRequest) (codeResult int, out *model.PaginatedResponse[product.ProductResponse], err error)
	
	// UpdateProduct - Cập nhật thông tin sản phẩm
	UpdateProduct(ctx context.Context, id int32, in *product.UpdateProductRequest) (codeResult int, out product.ProductResponse, err error)
	
	// DeleteProduct - Xóa sản phẩm khỏi hệ thống
	DeleteProduct(ctx context.Context, id int32) (codeResult int, err error)
	
	// SearchProducts - Tìm kiếm sản phẩm theo từ khóa
	SearchProducts(ctx context.Context, query string, limit, offset int32) (codeResult int, out []product.ProductResponse, err error)
	
	// FilterProducts - Lọc sản phẩm theo các tiêu chí phức tạp
	FilterProducts(ctx context.Context, in *product.FilterProductsRequest) (codeResult int, out []product.ProductResponse, err error)
	
	// GetProductStats - Lấy thống kê tổng quan về sản phẩm
	GetProductStats(ctx context.Context) (codeResult int, out product.ProductStats, err error)
	
	// BulkUpdateProducts - Cập nhật hàng loạt nhiều sản phẩm
	BulkUpdateProducts(ctx context.Context, in []product.UpdateProductRequest) (codeResult int, out []product.ProductResponse, err error)
}

// Các interface này được giữ lại để tương thích với code hiện tại
// nhưng triển khai sẽ được cập nhật để sử dụng ProductType

// MushroomService - Interface quản lý sản phẩm nấm (legacy)
// Đã deprecated, nên sử dụng IProductService với productType = 1
type MushroomService interface {
	// CreateMushroom - Tạo sản phẩm nấm mới
	CreateMushroom(ctx context.Context, name sql.NullString) (*database.Product, error)
	
	// GetMushroom - Lấy thông tin sản phẩm nấm theo ID
	GetMushroom(ctx context.Context, id int32) (*database.Product, error)
	
	// UpdateMushroom - Cập nhật thông tin sản phẩm nấm
	UpdateMushroom(ctx context.Context, params interface{}) (*database.Product, error)
	
	// DeleteMushroom - Xóa sản phẩm nấm
	DeleteMushroom(ctx context.Context, id int32) error
}

// VegetableService - Interface quản lý sản phẩm rau củ (legacy)
// Đã deprecated, nên sử dụng IProductService với productType = 2
type VegetableService interface {
	// CreateVegetable - Tạo sản phẩm rau củ mới
	CreateVegetable(ctx context.Context, name sql.NullString) (*database.Product, error)
	
	// GetVegetable - Lấy thông tin sản phẩm rau củ theo ID
	GetVegetable(ctx context.Context, id int32) (*database.Product, error)
	
	// UpdateVegetable - Cập nhật thông tin sản phẩm rau củ
	UpdateVegetable(ctx context.Context, params interface{}) (*database.Product, error)
	
	// DeleteVegetable - Xóa sản phẩm rau củ
	DeleteVegetable(ctx context.Context, id int32) error
}

// BonsaiService - Interface quản lý sản phẩm bonsai (legacy)
// Đã deprecated, nên sử dụng IProductService với productType = 3
type BonsaiService interface {
	// CreateBonsai - Tạo sản phẩm bonsai mới
	CreateBonsai(ctx context.Context, name sql.NullString) (*database.Product, error)
	
	// GetBonsai - Lấy thông tin sản phẩm bonsai theo ID
	GetBonsai(ctx context.Context, id int32) (*database.Product, error)
	
	// UpdateBonsai - Cập nhật thông tin sản phẩm bonsai
	UpdateBonsai(ctx context.Context, params interface{}) (*database.Product, error)
	
	// DeleteBonsai - Xóa sản phẩm bonsai
	DeleteBonsai(ctx context.Context, id int32) error
}

// Product type constants
const (
	ProductTypeMushroom  int32 = 1
	ProductTypeVegetable int32 = 2
	ProductTypeBonsai    int32 = 3
)

// Error variables
var (
	ErrInvalidProductType = fmt.Errorf("invalid product type")
)

// Product attributes
// @Description Product creation request with all fields
type ProductRequest struct {
	ProductName            string          `json:"productName" example:"Organic Tomato"`
	ProductPrice           string          `json:"productPrice" example:"15.99"`
	ProductStatus          int32           `json:"productStatus" example:"1"`
	ProductThumb           string          `json:"productThumb" example:"https://example.com/tomato.jpg"`
	ProductPictures        []string        `json:"productPictures"`
	ProductVideos          []string        `json:"productVideos"`
	ProductDescription     string          `json:"productDescription" example:"Fresh organic tomatoes"`
	ProductQuantity        int32           `json:"productQuantity" example:"100"`
	ProductType            int32           `json:"productType" example:"1"`
	SubProductType         []int32         `json:"subProductType" example:"[1,2]"`
	Discount               string          `json:"discount" example:"10"`
	ProductDiscountedPrice string          `json:"productDiscountedPrice" example:"14.39"`
	ProductAttributes      json.RawMessage `json:"productAttributes"`
	IsDraft                bool            `json:"isDraft" example:"false"`
	IsPublished            bool            `json:"isPublished" example:"true"`
}

// Các thuộc tính sản phẩm theo loại
type ProductAttributes interface{}

// Mushroom attributes
type MushroomAttributes struct {
	Brand    string `json:"brand"`
	Size     string `json:"size"`
	Material string `json:"material"`
}

// Vegetable attributes
type VegetableAttributes struct {
	Manufacturer string `json:"manufacturer"`
	Model        string `json:"model"`
	Color        string `json:"color"`
}

// Bonsai attributes
type BonsaiAttributes struct {
	Brand    string `json:"brand"`
	Size     string `json:"size"`
	Material string `json:"material"`
}

var (
	Product   IProductService
	Mushroom  MushroomService
	Vegetable VegetableService
	Bonsai    BonsaiService
)

func InitProductService(productService IProductService) {
	Product = productService
}

func InitMushroomService(mushroomService MushroomService) {
	Mushroom = mushroomService
}

func InitVegetableService(vegetableService VegetableService) {
	Vegetable = vegetableService
}

func InitBonsaiService(bonsaiService BonsaiService) {
	Bonsai = bonsaiService
}