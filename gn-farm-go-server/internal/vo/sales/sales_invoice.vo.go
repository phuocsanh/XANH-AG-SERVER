// Package sales - Chứa các Value Objects cho chức năng bán hàng
// Định nghĩa cấu trúc dữ liệu trao đổi giữa các layer: Controller <-> Service <-> Database
package sales

import (
	"time"
	"gn-farm-go-server/internal/model"
)

// ===== REQUEST DTOs =====

// CreateSalesInvoiceRequest - DTO để tạo phiếu bán hàng mới
type CreateSalesInvoiceRequest struct {
	// CustomerName - Tên khách hàng
	CustomerName    *string                      `json:"customer_name"`
	// CustomerPhone - Số điện thoại khách hàng
	CustomerPhone   *string                      `json:"customer_phone"`
	// CustomerEmail - Email khách hàng
	CustomerEmail   *string                      `json:"customer_email"`
	// CustomerAddress - Địa chỉ khách hàng
	CustomerAddress *string                      `json:"customer_address"`
	// PaymentMethod - Phương thức thanh toán
	PaymentMethod   string                       `json:"payment_method" binding:"required"`
	// DiscountAmount - Số tiền giảm giá tổng
	DiscountAmount  *string                      `json:"discount_amount"`
	// DeliveryDate - Ngày giao hàng dự kiến
	DeliveryDate    *time.Time                   `json:"delivery_date"`
	// Notes - Ghi chú
	Notes           *string                      `json:"notes"`
	// Items - Danh sách sản phẩm trong phiếu
	Items           []CreateSalesInvoiceItemRequest `json:"items" binding:"required,min=1"`
}

// CreateSalesInvoiceItemRequest - DTO để thêm sản phẩm vào phiếu
type CreateSalesInvoiceItemRequest struct {
	// ProductID - Mã sản phẩm
	ProductID       int32   `json:"product_id" binding:"required,min=1"`
	// Quantity - Số lượng bán
	Quantity        int32   `json:"quantity" binding:"required,min=1"`
	// UnitPrice - Giá bán đơn vị
	UnitPrice       string  `json:"unit_price" binding:"required"`
	// DiscountPercent - Phần trăm giảm giá cho sản phẩm
	DiscountPercent *string `json:"discount_percent"`
	// DiscountAmount - Số tiền giảm giá cho sản phẩm
	DiscountAmount  *string `json:"discount_amount"`
	// Notes - Ghi chú cho sản phẩm
	Notes           *string `json:"notes"`
}

// UpdateSalesInvoiceRequest - DTO để cập nhật phiếu bán hàng
type UpdateSalesInvoiceRequest struct {
	// CustomerName - Tên khách hàng
	CustomerName    *string    `json:"customer_name"`
	// CustomerPhone - Số điện thoại khách hàng
	CustomerPhone   *string    `json:"customer_phone"`
	// CustomerEmail - Email khách hàng
	CustomerEmail   *string    `json:"customer_email"`
	// CustomerAddress - Địa chỉ khách hàng
	CustomerAddress *string    `json:"customer_address"`
	// PaymentMethod - Phương thức thanh toán
	PaymentMethod   *string    `json:"payment_method"`
	// PaymentStatus - Trạng thái thanh toán
	PaymentStatus   *int32     `json:"payment_status"`
	// DiscountAmount - Số tiền giảm giá tổng
	DiscountAmount  *string    `json:"discount_amount"`
	// DeliveryDate - Ngày giao hàng dự kiến
	DeliveryDate    *time.Time `json:"delivery_date"`
	// CompletedDate - Ngày hoàn thành
	CompletedDate   *time.Time `json:"completed_date"`
	// Notes - Ghi chú
	Notes           *string    `json:"notes"`
	// Status - Trạng thái phiếu
	Status          *int32     `json:"status"`
}

// UpdateSalesInvoiceItemRequest - DTO để cập nhật sản phẩm trong phiếu
type UpdateSalesInvoiceItemRequest struct {
	// Quantity - Số lượng bán
	Quantity        *int32  `json:"quantity"`
	// UnitPrice - Giá bán đơn vị
	UnitPrice       *string `json:"unit_price"`
	// DiscountPercent - Phần trăm giảm giá cho sản phẩm
	DiscountPercent *string `json:"discount_percent"`
	// DiscountAmount - Số tiền giảm giá cho sản phẩm
	DiscountAmount  *string `json:"discount_amount"`
	// Notes - Ghi chú cho sản phẩm
	Notes           *string `json:"notes"`
}

// ListSalesInvoicesRequest - DTO để lấy danh sách phiếu bán hàng với phân trang
type ListSalesInvoicesRequest struct {
	// Page - Số trang (bắt đầu từ 1)
	Page       int32   `json:"page" form:"page" binding:"min=1"`
	// Limit - Số lượng item mỗi trang
	Limit      int32   `json:"limit" form:"limit" binding:"min=1,max=100"`
	// Status - Lọc theo trạng thái phiếu
	Status     *int32  `json:"status" form:"status"`
	// PaymentStatus - Lọc theo trạng thái thanh toán
	PaymentStatus *int32 `json:"payment_status" form:"payment_status"`
	// CustomerPhone - Tìm kiếm theo số điện thoại khách hàng
	CustomerPhone *string `json:"customer_phone" form:"customer_phone"`
	// FromDate - Lọc từ ngày
	FromDate   *time.Time `json:"from_date" form:"from_date"`
	// ToDate - Lọc đến ngày
	ToDate     *time.Time `json:"to_date" form:"to_date"`
}

// ===== RESPONSE DTOs =====

// SalesInvoiceResponse - DTO response cho phiếu bán hàng
type SalesInvoiceResponse struct {
	// ID - Mã định danh duy nhất của phiếu bán hàng
	ID               int32      `json:"id"`
	// InvoiceCode - Mã phiếu bán hàng
	InvoiceCode      string     `json:"invoice_code"`
	// CustomerName - Tên khách hàng
	CustomerName     *string    `json:"customer_name"`
	// CustomerPhone - Số điện thoại khách hàng
	CustomerPhone    *string    `json:"customer_phone"`
	// CustomerEmail - Email khách hàng
	CustomerEmail    *string    `json:"customer_email"`
	// CustomerAddress - Địa chỉ khách hàng
	CustomerAddress  *string    `json:"customer_address"`
	// CreatedByUserID - ID của người dùng tạo phiếu
	CreatedByUserID  int32      `json:"created_by_user_id"`
	// TotalAmount - Tổng giá trị phiếu bán hàng trước giảm giá
	TotalAmount      string     `json:"total_amount"`
	// TotalItems - Tổng số mặt hàng trong phiếu
	TotalItems       int32      `json:"total_items"`
	// DiscountAmount - Số tiền giảm giá
	DiscountAmount   string     `json:"discount_amount"`
	// FinalAmount - Số tiền cuối cùng sau giảm giá
	FinalAmount      string     `json:"final_amount"`
	// PaymentMethod - Phương thức thanh toán
	PaymentMethod    string     `json:"payment_method"`
	// PaymentStatus - Trạng thái thanh toán
	PaymentStatus    int32      `json:"payment_status"`
	// PaymentStatusText - Text hiển thị trạng thái thanh toán
	PaymentStatusText string    `json:"payment_status_text"`
	// Notes - Ghi chú
	Notes            *string    `json:"notes"`
	// Status - Trạng thái hiện tại của phiếu
	Status           int32      `json:"status"`
	// StatusText - Text hiển thị trạng thái phiếu
	StatusText       string     `json:"status_text"`
	// InvoiceDate - Ngày lập phiếu bán hàng
	InvoiceDate      time.Time  `json:"invoice_date"`
	// DeliveryDate - Ngày giao hàng dự kiến
	DeliveryDate     *time.Time `json:"delivery_date"`
	// CompletedDate - Ngày hoàn thành thực tế
	CompletedDate    *time.Time `json:"completed_date"`
	// CreatedAt - Thời gian tạo phiếu trong hệ thống
	CreatedAt        time.Time  `json:"created_at"`
	// UpdatedAt - Thời gian cập nhật phiếu lần cuối
	UpdatedAt        time.Time  `json:"updated_at"`
	// Items - Danh sách sản phẩm trong phiếu (nếu có)
	Items            []SalesInvoiceItemResponse `json:"items,omitempty"`
}

// SalesInvoiceItemResponse - DTO response cho chi tiết sản phẩm trong phiếu
type SalesInvoiceItemResponse struct {
	// ID - Mã định danh duy nhất của item trong phiếu
	ID              int32     `json:"id"`
	// InvoiceID - Mã phiếu bán hàng mà item này thuộc về
	InvoiceID       int32     `json:"invoice_id"`
	// ProductID - Mã sản phẩm được bán
	ProductID       int32     `json:"product_id"`
	// ProductName - Tên sản phẩm (join từ bảng products)
	ProductName     string    `json:"product_name"`
	// Quantity - Số lượng sản phẩm bán ra
	Quantity        int32     `json:"quantity"`
	// UnitPrice - Giá bán đơn vị của sản phẩm
	UnitPrice       string    `json:"unit_price"`
	// TotalPrice - Tổng giá trị trước giảm giá
	TotalPrice      string    `json:"total_price"`
	// DiscountPercent - Phần trăm giảm giá cho sản phẩm
	DiscountPercent string    `json:"discount_percent"`
	// DiscountAmount - Số tiền giảm giá cho sản phẩm
	DiscountAmount  string    `json:"discount_amount"`
	// FinalPrice - Giá cuối cùng sau giảm giá
	FinalPrice      string    `json:"final_price"`
	// Notes - Ghi chú đặc biệt cho sản phẩm này
	Notes           *string   `json:"notes"`
	// CreatedAt - Thời gian tạo item trong phiếu
	CreatedAt       time.Time `json:"created_at"`
	// UpdatedAt - Thời gian cập nhật item lần cuối
	UpdatedAt       time.Time `json:"updated_at"`
}

// ListSalesInvoicesResponse - DTO response cho danh sách phiếu bán hàng
type ListSalesInvoicesResponse struct {
	// Items - Danh sách phiếu bán hàng
	Items      []SalesInvoiceResponse `json:"items"`
	// Pagination - Thông tin phân trang
	Pagination model.PaginationMeta   `json:"pagination"`
}

// ===== ACTION REQUEST DTOs =====

// ConfirmSalesInvoiceRequest - DTO để xác nhận phiếu bán hàng
type ConfirmSalesInvoiceRequest struct {
	// CheckedByUserID - ID người kiểm tra phiếu
	CheckedByUserID int32   `json:"checked_by_user_id"`
	// Notes - Ghi chú thêm khi xác nhận
	Notes           *string `json:"notes"`
}

// DeliverSalesInvoiceRequest - DTO để đánh dấu đã giao hàng
type DeliverSalesInvoiceRequest struct {
	// DeliveredByUserID - ID người giao hàng
	DeliveredByUserID int32      `json:"delivered_by_user_id"`
	// DeliveryDate - Ngày giao hàng thực tế
	DeliveryDate      time.Time  `json:"delivery_date"`
	// Notes - Ghi chú về việc giao hàng
	Notes             *string    `json:"notes"`
}

// CompleteSalesInvoiceRequest - DTO để hoàn thành phiếu bán hàng
type CompleteSalesInvoiceRequest struct {
	// CompletedByUserID - ID người hoàn thành phiếu
	CompletedByUserID int32      `json:"completed_by_user_id"`
	// CompletedDate - Ngày hoàn thành
	CompletedDate     time.Time  `json:"completed_date"`
	// PaymentStatus - Trạng thái thanh toán cuối cùng
	PaymentStatus     int32      `json:"payment_status"`
	// Notes - Ghi chú khi hoàn thành
	Notes             *string    `json:"notes"`
}

// CancelSalesInvoiceRequest - DTO để hủy phiếu bán hàng
type CancelSalesInvoiceRequest struct {
	// CancelledByUserID - ID người hủy phiếu
	CancelledByUserID int32  `json:"cancelled_by_user_id"`
	// Reason - Lý do hủy phiếu
	Reason            string `json:"reason" binding:"required"`
}

// ===== UTILITY FUNCTIONS =====

// GetStatusText - Trả về text hiển thị cho trạng thái phiếu
func GetStatusText(status int32) string {
	switch status {
	case 1:
		return "Nháp"
	case 2:
		return "Đã xác nhận"
	case 3:
		return "Đã giao hàng"
	case 4:
		return "Hoàn thành"
	case 5:
		return "Đã hủy"
	default:
		return "Không xác định"
	}
}

// GetPaymentStatusText - Trả về text hiển thị cho trạng thái thanh toán
func GetPaymentStatusText(paymentStatus int32) string {
	switch paymentStatus {
	case 1:
		return "Chưa thanh toán"
	case 2:
		return "Thanh toán một phần"
	case 3:
		return "Đã thanh toán đủ"
	default:
		return "Không xác định"
	}
}