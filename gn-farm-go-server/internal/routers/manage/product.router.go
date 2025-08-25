// Package manage - Chứa các router quản lý sản phẩm cho admin
package manage

import (
	"gn-farm-go-server/internal/controller/product"
	"gn-farm-go-server/internal/middlewares"

	"github.com/gin-gonic/gin"
)

// ProductManageRouter - Cấu trúc quản lý các route sản phẩm dành cho admin
// Cung cấp đầy đủ các chức năng CRUD cho sản phẩm, loại sản phẩm và phân loại phụ
type ProductManageRouter struct{}

// InitProductManageRouter - Khởi tạo các route quản lý sản phẩm cho admin
// Tất cả routes đều yêu cầu xác thực admin và bao gồm:
// - Quản lý sản phẩm: CRUD, tìm kiếm, lọc, thống kê
// - Quản lý loại sản phẩm (Product Type)
// - Quản lý phân loại phụ (Product Subtype) và mối quan hệ
func (pr *ProductManageRouter) InitProductManageRouter(Router *gin.RouterGroup) {
	// Private routes - Các route riêng tư yêu cầu xác thực admin
	// Tất cả đều cần AuthenMiddleware() để kiểm tra JWT token và quyền admin
	productRouterPrivate := Router.Group("/manage/product")
	productRouterPrivate.Use(middlewares.AuthenMiddleware())
	{
		// ===== QUẢN LÝ SẢN PHẨM CHÍNH =====
		// GET /manage/product - Lấy danh sách tất cả sản phẩm với phân trang
		productRouterPrivate.GET("", product.Product.ListProducts)
		// GET /manage/product/search - Tìm kiếm sản phẩm theo tên, mô tả, SKU
		productRouterPrivate.GET("/search", product.Product.SearchProducts)
		// GET /manage/product/filter - Lọc sản phẩm theo tiêu chí (giá, loại, trạng thái)
		productRouterPrivate.GET("/filter", product.Product.FilterProducts)
		// GET /manage/product/stats - Lấy thống kê tổng quan sản phẩm
		productRouterPrivate.GET("/stats", product.Product.GetProductStats)
		// GET /manage/product/:id - Lấy chi tiết một sản phẩm theo ID
		productRouterPrivate.GET("/:id", product.Product.GetProduct)
		// POST /manage/product - Tạo sản phẩm mới
		productRouterPrivate.POST("", product.Product.CreateProduct)
		// PUT /manage/product/:id - Cập nhật toàn bộ thông tin sản phẩm
		productRouterPrivate.PUT("/:id", product.Product.UpdateProduct)
		// DELETE /manage/product/:id - Xóa sản phẩm (soft delete)
		productRouterPrivate.DELETE("/:id", product.Product.DeleteProduct)
		// POST /manage/product/bulk-update - Cập nhật nhiều sản phẩm cùng lúc
		productRouterPrivate.POST("/bulk-update", product.Product.BulkUpdateProducts)

		// ===== QUẢN LÝ LOẠI SẢN PHẨM (PRODUCT TYPE) =====
		// GET /manage/product/type - Lấy danh sách tất cả loại sản phẩm
		productRouterPrivate.GET("/type", product.ProductType.ListProductTypes)
		// GET /manage/product/type/:id - Lấy chi tiết một loại sản phẩm
		productRouterPrivate.GET("/type/:id", product.ProductType.GetProductType)
		// GET /manage/product/type/:id/subtypes - Lấy tất cả phân loại phụ của loại sản phẩm
		productRouterPrivate.GET("/type/:id/subtypes", product.ProductSubtype.ListProductSubtypesByType)
		// POST /manage/product/type - Tạo loại sản phẩm mới
		productRouterPrivate.POST("/type", product.ProductType.CreateProductType)
		// PUT /manage/product/type/:id - Cập nhật loại sản phẩm
		productRouterPrivate.PUT("/type/:id", product.ProductType.UpdateProductType)
		// DELETE /manage/product/type/:id - Xóa loại sản phẩm
		productRouterPrivate.DELETE("/type/:id", product.ProductType.DeleteProductType)

		// ===== QUẢN LÝ PHÂN LOẠI PHỤ (PRODUCT SUBTYPE) =====
		// GET /manage/product/subtype - Lấy danh sách tất cả phân loại phụ
		productRouterPrivate.GET("/subtype", product.ProductSubtype.ListProductSubtypes)
		// GET /manage/product/subtype/:id - Lấy chi tiết một phân loại phụ
		productRouterPrivate.GET("/subtype/:id", product.ProductSubtype.GetProductSubtype)
		// POST /manage/product/subtype - Tạo phân loại phụ mới
		productRouterPrivate.POST("/subtype", product.ProductSubtype.CreateProductSubtype)
		// PUT /manage/product/subtype/:id - Cập nhật phân loại phụ
		productRouterPrivate.PUT("/subtype/:id", product.ProductSubtype.UpdateProductSubtype)
		// DELETE /manage/product/subtype/:id - Xóa phân loại phụ
		productRouterPrivate.DELETE("/subtype/:id", product.ProductSubtype.DeleteProductSubtype)
		// POST /manage/product/subtype/mapping - Thêm mối liên kết giữa sản phẩm và phân loại phụ
		productRouterPrivate.POST("/subtype/mapping", product.ProductSubtype.AddProductSubtypeMapping)
		// DELETE /manage/product/subtype/mapping - Xóa mối liên kết giữa sản phẩm và phân loại phụ
		productRouterPrivate.DELETE("/subtype/mapping", product.ProductSubtype.RemoveProductSubtypeMapping)

		// ===== QUẢN LÝ MỐI QUAN HỆ SẢN PHẨM - PHÂN LOẠI PHỤ =====
		// GET /manage/product/:id/subtypes - Lấy tất cả phân loại phụ của một sản phẩm
		productRouterPrivate.GET("/:id/subtypes", product.ProductSubtypeRelation.GetProductSubtypeRelations)
		// POST /manage/product/:id/subtype/:subtypeId - Thêm phân loại phụ cho sản phẩm
		productRouterPrivate.POST("/:id/subtype/:subtypeId", product.ProductSubtypeRelation.AddProductSubtypeRelation)
		// DELETE /manage/product/:id/subtype/:subtypeId - Xóa một phân loại phụ khỏi sản phẩm
		productRouterPrivate.DELETE("/:id/subtype/:subtypeId", product.ProductSubtypeRelation.RemoveProductSubtypeRelation)
		// DELETE /manage/product/:id/subtypes - Xóa tất cả phân loại phụ khỏi sản phẩm
		productRouterPrivate.DELETE("/:id/subtypes", product.ProductSubtypeRelation.RemoveAllProductSubtypeRelations)
	}
}
