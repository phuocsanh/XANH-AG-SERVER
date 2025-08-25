// Package manage - Chứa các router quản lý kho hàng cho admin
package manage

import (
	"gn-farm-go-server/internal/controller/inventory"
	"gn-farm-go-server/internal/middlewares"

	"github.com/gin-gonic/gin"
)

// InventoryManageRouter - Cấu trúc quản lý các route kho hàng dành cho admin
// Cung cấp đầy đủ chức năng quản lý nhập/xuất kho, phiếu nhập, và lịch sử tồn kho
type InventoryManageRouter struct{}

// InitInventoryManageRouter - Khởi tạo các route quản lý kho hàng
// Bao gồm cả public routes (cho testing) và private routes (yêu cầu authentication)
func (ir *InventoryManageRouter) InitInventoryManageRouter(Router *gin.RouterGroup) {
	
	// Public routes - Các route công khai cho mục đích testing và demo
	// Không cần xác thực, dùng để kiểm thử chức năng nhập kho
	inventoryRouterPublic := Router.Group("/inventory")
	{
		// POST /inventory/stock-in - API công khai để test chức năng nhập kho
		// Sử dụng để testing và demo tính năng nhập hàng trực tiếp
		inventoryRouterPublic.POST("/stock-in", inventory.Inventory.ProcessStockIn)
	}

	// Private routes - Các route riêng tư yêu cầu xác thực admin
	// Tất cả đều cần AuthenMiddleware() để kiểm tra JWT token và quyền quản lý
	inventoryRouterPrivate := Router.Group("/manage/inventory")
	inventoryRouterPrivate.Use(middlewares.AuthenMiddleware())
	{
		// ===== QUẢN LÝ PHIẾU NHẬP KHO (INVENTORY RECEIPTS) =====
		// POST /manage/inventory/receipt - Tạo phiếu nhập kho mới
		inventoryRouterPrivate.POST("/receipt", inventory.Inventory.CreateInventoryReceipt)
		// GET /manage/inventory/receipts - Lấy danh sách tất cả phiếu nhập kho với phân trang
		inventoryRouterPrivate.GET("/receipts", inventory.Inventory.ListInventoryReceipts)
		// GET /manage/inventory/receipt/:id - Lấy chi tiết phiếu nhập theo ID
		inventoryRouterPrivate.GET("/receipt/:id", inventory.Inventory.GetInventoryReceipt)
		// GET /manage/inventory/receipt/code/:code - Tìm phiếu nhập theo mã phiếu
		inventoryRouterPrivate.GET("/receipt/code/:code", inventory.Inventory.GetInventoryReceiptByCode)
		// PUT /manage/inventory/receipt/:id - Cập nhật thông tin phiếu nhập
		inventoryRouterPrivate.PUT("/receipt/:id", inventory.Inventory.UpdateInventoryReceipt)
		// DELETE /manage/inventory/receipt/:id - Xóa phiếu nhập kho
		inventoryRouterPrivate.DELETE("/receipt/:id", inventory.Inventory.DeleteInventoryReceipt)

		// ===== CÁC HÀNH ĐỘNG VỚI PHIẾU NHẬP (RECEIPT ACTIONS) =====
		// POST /manage/inventory/receipt/:id/approve - Phê duyệt phiếu nhập kho
		// Chuyển trạng thái phiếu từ đợ duyệt sang đã duyệt
		inventoryRouterPrivate.POST("/receipt/:id/approve", inventory.Inventory.ApproveInventoryReceipt)
		// POST /manage/inventory/receipt/:id/complete - Hoàn thành phiếu nhập kho
		// Cập nhật tồn kho và đánh dấu phiếu đã hoàn thành
		inventoryRouterPrivate.POST("/receipt/:id/complete", inventory.Inventory.CompleteInventoryReceipt)
		// POST /manage/inventory/receipt/:id/cancel - Hủy phiếu nhập kho
		// Hủy phiếu và ghi lý do hủy
		inventoryRouterPrivate.POST("/receipt/:id/cancel", inventory.Inventory.CancelInventoryReceipt)

		// ===== QUẢN LÝ CHI TIẾT PHIẾU NHẬP (RECEIPT ITEMS) =====
		// GET /manage/inventory/receipt/:id/items - Lấy danh sách sản phẩm trong phiếu nhập
		inventoryRouterPrivate.GET("/receipt/:id/items", inventory.Inventory.GetInventoryReceiptItems)
		// PUT /manage/inventory/receipt/item/:id - Cập nhật thông tin một sản phẩm trong phiếu
		// Cập nhật số lượng, giá, ghi chú của từng item
		inventoryRouterPrivate.PUT("/receipt/item/:id", inventory.Inventory.UpdateInventoryReceiptItem)
		// DELETE /manage/inventory/receipt/item/:id - Xóa một sản phẩm khỏi phiếu nhập
		inventoryRouterPrivate.DELETE("/receipt/item/:id", inventory.Inventory.DeleteInventoryReceiptItem)

		// ===== QUẢN LÝ NHẬP/XUẤT KHO TRỰC TIẾP =====
		// POST /manage/inventory/stock-in - Nhập hàng trực tiếp vào kho
		// Xử lý nhập kho với tính toán giá trung bình gia quyền
		inventoryRouterPrivate.POST("/stock-in", inventory.Inventory.ProcessStockIn)

		// ===== LỊCH Sử VÀ BÁO CÁO KHO HÀNG =====
		// GET /manage/inventory/product-history - Lấy lịch sử nhập/xuất của tất cả sản phẩm
		inventoryRouterPrivate.GET("/product-history", inventory.Inventory.GetInventoryHistory)
		// GET /manage/inventory/product-history/:product_id - Lấy lịch sử của một sản phẩm cụ thể
		inventoryRouterPrivate.GET("/product-history/:product_id", inventory.Inventory.GetInventoryHistory)
		// GET /manage/inventory/receipt-items/:receipt_id - Lấy chi tiết sản phẩm trong phiếu theo receipt_id
		// Duplicate endpoint, có thể xây dựng lại cho consistent API
		inventoryRouterPrivate.GET("/receipt-items/:receipt_id", inventory.Inventory.GetInventoryReceiptItems)
	}

}
