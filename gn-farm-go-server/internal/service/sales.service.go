package service

import (
	"context"
	salesVO "gn-farm-go-server/internal/vo/sales"
	"gn-farm-go-server/pkg/response"
)

// ISalesService interface cho service quản lý bán hàng
type ISalesService interface {
	// ===== QUẢN LÝ PHIẾU BÁN HÀNG =====
	
	// CreateSalesInvoice - Tạo phiếu bán hàng mới
	// Tạo phiếu với trạng thái nháp, tự động sinh mã phiếu và tính tổng tiền
	CreateSalesInvoice(ctx context.Context, userID int32, req *salesVO.CreateSalesInvoiceRequest) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error)
	
	// GetSalesInvoice - Lấy chi tiết phiếu bán hàng theo ID
	// Bao gồm cả danh sách sản phẩm trong phiếu
	GetSalesInvoice(ctx context.Context, id int32) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error)
	
	// GetSalesInvoiceByCode - Lấy chi tiết phiếu bán hàng theo mã phiếu
	// Tìm kiếm phiếu bằng invoice_code
	GetSalesInvoiceByCode(ctx context.Context, code string) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error)
	
	// ListSalesInvoices - Lấy danh sách phiếu bán hàng với phân trang và filter
	// Hỗ trợ filter theo trạng thái, khách hàng, ngày tháng
	ListSalesInvoices(ctx context.Context, req *salesVO.ListSalesInvoicesRequest) (*salesVO.ListSalesInvoicesResponse, *response.ResponseData, error)
	
	// UpdateSalesInvoice - Cập nhật thông tin phiếu bán hàng
	// Chỉ cho phép cập nhật khi phiếu ở trạng thái nháp hoặc đã xác nhận
	UpdateSalesInvoice(ctx context.Context, id int32, req *salesVO.UpdateSalesInvoiceRequest) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error)
	
	// DeleteSalesInvoice - Xóa phiếu bán hàng
	// Chỉ cho phép xóa khi phiếu ở trạng thái nháp
	DeleteSalesInvoice(ctx context.Context, id int32) (*response.ResponseData, error)

	// ===== CÁC HÀNH ĐỘNG VỚI PHIẾU BÁN HÀNG =====
	
	// ConfirmSalesInvoice - Xác nhận phiếu bán hàng
	// Chuyển từ trạng thái nháp sang đã xác nhận, kiểm tra tồn kho
	ConfirmSalesInvoice(ctx context.Context, id int32, req *salesVO.ConfirmSalesInvoiceRequest) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error)
	
	// DeliverSalesInvoice - Đánh dấu đã giao hàng
	// Chuyển sang trạng thái đã giao hàng và cập nhật inventory
	DeliverSalesInvoice(ctx context.Context, id int32, req *salesVO.DeliverSalesInvoiceRequest) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error)
	
	// CompleteSalesInvoice - Hoàn thành phiếu bán hàng
	// Đánh dấu giao dịch hoàn tất, cập nhật trạng thái thanh toán
	CompleteSalesInvoice(ctx context.Context, id int32, req *salesVO.CompleteSalesInvoiceRequest) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error)
	
	// CancelSalesInvoice - Hủy phiếu bán hàng
	// Hủy phiếu và hoàn trả inventory nếu đã xuất kho
	CancelSalesInvoice(ctx context.Context, id int32, req *salesVO.CancelSalesInvoiceRequest) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error)

	// ===== QUẢN LÝ CHI TIẾT SẢN PHẨM TRONG PHIẾU =====
	
	// GetSalesInvoiceItems - Lấy danh sách sản phẩm trong phiếu bán hàng
	// Trả về chi tiết tất cả sản phẩm của một phiếu
	GetSalesInvoiceItems(ctx context.Context, invoiceID int32) ([]salesVO.SalesInvoiceItemResponse, *response.ResponseData, error)
	
	// UpdateSalesInvoiceItem - Cập nhật thông tin một sản phẩm trong phiếu
	// Chỉ cho phép cập nhật khi phiếu chưa giao hàng
	UpdateSalesInvoiceItem(ctx context.Context, id int32, req *salesVO.UpdateSalesInvoiceItemRequest) (*salesVO.SalesInvoiceItemResponse, *response.ResponseData, error)
	
	// DeleteSalesInvoiceItem - Xóa một sản phẩm khỏi phiếu bán hàng
	// Chỉ cho phép xóa khi phiếu ở trạng thái nháp
	DeleteSalesInvoiceItem(ctx context.Context, id int32) (*response.ResponseData, error)

	// ===== BÁO CÁO VÀ THỐNG KÊ =====
	
	// GetSalesReport - Lấy báo cáo bán hàng theo thời gian
	// Thống kê doanh thu, số lượng đơn hàng, sản phẩm bán chạy
	// GetSalesReport(ctx context.Context, req *salesVO.SalesReportRequest) (*salesVO.SalesReportResponse, *response.ResponseData, error)
}

var (
	// Sales - Global variable cho Sales service
	Sales ISalesService
)

// InitSalesService - Khởi tạo Sales service
func InitSalesService(salesService ISalesService) {
	Sales = salesService
}

// Sales - Trả về instance của ISalesService
func GetSalesService() ISalesService {
	return Sales
}