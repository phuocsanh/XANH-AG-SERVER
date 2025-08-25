// Package manage - Chứa các router cho chức năng quản lý bán hàng dành cho admin
package manage

import (
	"gn-farm-go-server/internal/controller/sales"
	"gn-farm-go-server/internal/middlewares"
	"gn-farm-go-server/internal/service"

	"github.com/gin-gonic/gin"
)

// SalesManageRouter - Cấu trúc quản lý các route bán hàng dành cho admin
// Cung cấp đầy đủ chức năng quản lý phiếu bán hàng, giao dịch bán hàng và báo cáo doanh thu
type SalesManageRouter struct{}

// InitSalesManageRouter - Khởi tạo các route quản lý bán hàng
// Bao gồm cả public routes (cho testing) và private routes (yêu cầu authentication)
func (sr *SalesManageRouter) InitSalesManageRouter(Router *gin.RouterGroup) {
	
	// Tạo controller instance với service đã được inject
	salesController := sales.NewSalesController(service.GetSalesService())
	
	// Public routes - Các route công khai cho mục đích testing và demo
	// Không cần xác thực, dùng để kiểm thử chức năng bán hàng
	salesRouterPublic := Router.Group("/sales")
	{
		// GET /sales/invoices - API công khai để test lấy danh sách phiếu bán hàng
		// Sử dụng để testing và demo tính năng tìm kiếm phiếu
		salesRouterPublic.GET("/invoices", salesController.ListSalesInvoices)
		// GET /sales/invoice/:id - API công khai để test lấy chi tiết phiếu
		salesRouterPublic.GET("/invoice/:id", salesController.GetSalesInvoice)
	}

	// Private routes - Các route riêng tư yêu cầu xác thực admin
	// Tất cả đều cần AuthenMiddleware() để kiểm tra JWT token và quyền quản lý
	salesRouterPrivate := Router.Group("/manage/sales")
	salesRouterPrivate.Use(middlewares.AuthenMiddleware())
	{
		// ===== QUẢN LÝ PHIẾU BÁN HÀNG (SALES INVOICES) =====
		// POST /manage/sales/invoice - Tạo phiếu bán hàng mới
		salesRouterPrivate.POST("/invoice", salesController.CreateSalesInvoice)
		// GET /manage/sales/invoices - Lấy danh sách tất cả phiếu bán hàng với phân trang và filter
		salesRouterPrivate.GET("/invoices", salesController.ListSalesInvoices)
		// GET /manage/sales/invoice/:id - Lấy chi tiết phiếu bán hàng theo ID
		salesRouterPrivate.GET("/invoice/:id", salesController.GetSalesInvoice)
		// GET /manage/sales/invoice/code/:code - Tìm phiếu bán hàng theo mã phiếu
		salesRouterPrivate.GET("/invoice/code/:code", salesController.GetSalesInvoiceByCode)
		// PUT /manage/sales/invoice/:id - Cập nhật thông tin phiếu bán hàng
		salesRouterPrivate.PUT("/invoice/:id", salesController.UpdateSalesInvoice)
		// DELETE /manage/sales/invoice/:id - Xóa phiếu bán hàng
		salesRouterPrivate.DELETE("/invoice/:id", salesController.DeleteSalesInvoice)

		// ===== CÁC HÀNH ĐỘNG VỚI PHIẾU BÁN HÀNG (INVOICE ACTIONS) =====
		// POST /manage/sales/invoice/:id/confirm - Xác nhận phiếu bán hàng
		// Chuyển trạng thái phiếu từ nháp sang đã xác nhận, kiểm tra tồn kho
		salesRouterPrivate.POST("/invoice/:id/confirm", salesController.ConfirmSalesInvoice)
		// POST /manage/sales/invoice/:id/deliver - Đánh dấu đã giao hàng
		// Cập nhật inventory và chuyển trạng thái sang đã giao hàng
		salesRouterPrivate.POST("/invoice/:id/deliver", salesController.DeliverSalesInvoice)
		// POST /manage/sales/invoice/:id/complete - Hoàn thành phiếu bán hàng
		// Đánh dấu giao dịch hoàn tất và cập nhật trạng thái thanh toán
		salesRouterPrivate.POST("/invoice/:id/complete", salesController.CompleteSalesInvoice)
		// POST /manage/sales/invoice/:id/cancel - Hủy phiếu bán hàng
		// Hủy phiếu và hoàn trả inventory nếu đã xuất kho
		salesRouterPrivate.POST("/invoice/:id/cancel", salesController.CancelSalesInvoice)

		// ===== QUẢN LÝ CHI TIẾT SẢN PHẨM TRONG PHIẾU (INVOICE ITEMS) =====
		// GET /manage/sales/invoice/:id/items - Lấy danh sách sản phẩm trong phiếu bán hàng
		salesRouterPrivate.GET("/invoice/:id/items", salesController.GetSalesInvoiceItems)
		// PUT /manage/sales/invoice/item/:id - Cập nhật thông tin một sản phẩm trong phiếu
		// Cập nhật số lượng, giá, giảm giá của từng item
		salesRouterPrivate.PUT("/invoice/item/:id", salesController.UpdateSalesInvoiceItem)
		// DELETE /manage/sales/invoice/item/:id - Xóa một sản phẩm khỏi phiếu bán hàng
		salesRouterPrivate.DELETE("/invoice/item/:id", salesController.DeleteSalesInvoiceItem)

		// ===== BÁO CÁO VÀ THỐNG KÊ BÁN HÀNG =====
		// Các endpoint này sẽ được thêm vào sau
		// GET /manage/sales/reports/daily - Báo cáo doanh thu theo ngày
		// GET /manage/sales/reports/monthly - Báo cáo doanh thu theo tháng
		// GET /manage/sales/reports/products - Báo cáo sản phẩm bán chạy
		// GET /manage/sales/reports/customers - Báo cáo khách hàng VIP
	}

}