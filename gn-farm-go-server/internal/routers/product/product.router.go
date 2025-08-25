// Package product - Chứa các router sản phẩm công khai
package product

import (
	"gn-farm-go-server/internal/controller/product"

	"github.com/gin-gonic/gin"
)

// ProductRouter - Cấu trúc quản lý các route sản phẩm công khai
// Cung cấp các API cho người dùng cuối xem và tìm kiếm sản phẩm
// Không yêu cầu xác thực, ai cũng có thể truy cập
type ProductRouter struct{}

// InitProductRouter - Khởi tạo các route sản phẩm công khai
// Chỉ bao gồm các chức năng đọc (read-only) và một số API testing
// Các chức năng quản lý (CRUD) đã được chuyển sang manage/product.router.go
func (pr *ProductRouter) InitProductRouter(Router *gin.RouterGroup) {
	// Public routes - Các route công khai không cần xác thực
	// Dành cho người dùng cuối, khách hàng xem sản phẩm
	productRouterPublic := Router.Group("/product")
	{
		// ===== CÁC API XEM SẢN PHẨM CÔNG KHAI =====
		// GET /product/search - Tìm kiếm sản phẩm theo từ khóa
		productRouterPublic.GET("/search", product.Product.SearchProducts)
		// GET /product/filter - Lọc sản phẩm theo tiêu chí (giá, loại, etc.)
		productRouterPublic.GET("/filter", product.Product.FilterProducts)
		// GET /product/stats - Thống kê tổng quan về sản phẩm (công khai)
		productRouterPublic.GET("/stats", product.Product.GetProductStats)
		// GET /product/:id - Xem chi tiết một sản phẩm
		productRouterPublic.GET("/:id", product.Product.GetProduct)
		// GET /product - Lấy danh sách tất cả sản phẩm công khai
		productRouterPublic.GET("", product.Product.ListProducts)
		// POST /product - API testing tạo sản phẩm (sẽ được chuyển sang admin sau)
		productRouterPublic.POST("", product.Product.CreateProduct)

		// Lưu ý: Các route cho Mushroom, Vegetable, và Bonsai đã được loại bỏ
		// vì chúng nên được xử lý như các product_type thông qua ProductTypeController

		// ===== CÁC API LOẠI SẢN PHẨM CÔNG KHAI =====
		// GET /product/type - Xem tất cả loại sản phẩm
		productRouterPublic.GET("/type", product.ProductType.ListProductTypes)
		// GET /product/type/:id - Xem chi tiết một loại sản phẩm
		productRouterPublic.GET("/type/:id", product.ProductType.GetProductType)
		// GET /product/type/:id/subtypes - Xem các phân loại phụ của loại sản phẩm
		productRouterPublic.GET("/type/:id/subtypes", product.ProductSubtype.ListProductSubtypesByType)

		// ===== CÁC API PHÂN LOẠI PHỤ CÔNG KHAI =====
		// GET /product/subtype - Xem tất cả phân loại phụ
		productRouterPublic.GET("/subtype", product.ProductSubtype.ListProductSubtypes)
		// GET /product/subtype/:id - Xem chi tiết một phân loại phụ
		productRouterPublic.GET("/subtype/:id", product.ProductSubtype.GetProductSubtype)

		// ===== MỐI QUAN HỆ SẢN PHẨM - PHÂN LOẠI PHỤ =====
		// GET /product/:id/subtypes - Xem các phân loại phụ của sản phẩm
		productRouterPublic.GET("/:id/subtypes", product.ProductSubtypeRelation.GetProductSubtypeRelations)
	}

	// Lưu ý: Các API private (CRUD, quản lý) đã được chuyển sang manage/product.router.go
	// với đường dẫn /manage/product/... và yêu cầu xác thực admin
}