// Package sales - Chứa các model liên quan đến quản lý bán hàng
// Bao gồm phiếu bán hàng, chi tiết sản phẩm và các trạng thái liên quan
package sales

import (
	"time"
)

// SalesInvoice - Model chứa thông tin phiếu bán hàng
// Quản lý toàn bộ quy trình bán hàng từ tạo phiếu đến hoàn thành
// Bao gồm các trạng thái: Nháp -> Đã xác nhận -> Đã giao hàng -> Hoàn thành -> Hủy
type SalesInvoice struct {
	// ID - Mã định danh duy nhất của phiếu bán hàng
	ID               int32      `json:"id"`
	// InvoiceCode - Mã phiếu bán hàng (tự sinh hoặc nhập thủ công)
	InvoiceCode      string     `json:"invoice_code"`
	// CustomerName - Tên khách hàng (có thể null)
	CustomerName     *string    `json:"customer_name"`
	// CustomerPhone - Số điện thoại khách hàng (có thể null)
	CustomerPhone    *string    `json:"customer_phone"`
	// CustomerEmail - Email khách hàng (có thể null)
	CustomerEmail    *string    `json:"customer_email"`
	// CustomerAddress - Địa chỉ khách hàng (có thể null)
	CustomerAddress  *string    `json:"customer_address"`
	// CreatedByUserID - ID của người dùng tạo phiếu bán hàng
	CreatedByUserID  int32      `json:"created_by_user_id"`
	// TotalAmount - Tổng giá trị phiếu bán hàng trước giảm giá (dạng text để hỗ trợ số lớn)
	TotalAmount      string     `json:"total_amount"`
	// TotalItems - Tổng số mặt hàng trong phiếu
	TotalItems       int32      `json:"total_items"`
	// DiscountAmount - Số tiền giảm giá (dạng text)
	DiscountAmount   string     `json:"discount_amount"`
	// FinalAmount - Số tiền cuối cùng sau giảm giá (dạng text)
	FinalAmount      string     `json:"final_amount"`
	// PaymentMethod - Phương thức thanh toán (CASH, BANK_TRANSFER, CARD)
	PaymentMethod    string     `json:"payment_method"`
	// PaymentStatus - Trạng thái thanh toán (1: Chưa thanh toán, 2: Thanh toán một phần, 3: Đã thanh toán đủ)
	PaymentStatus    int32      `json:"payment_status"`
	// Notes - Ghi chú thêm cho phiếu bán hàng
	Notes            *string    `json:"notes"`
	// Status - Trạng thái hiện tại của phiếu (1: Nháp, 2: Đã xác nhận, 3: Đã giao hàng, 4: Hoàn thành, 5: Hủy)
	Status           int32      `json:"status"`
	// InvoiceDate - Ngày lập phiếu bán hàng
	InvoiceDate      time.Time  `json:"invoice_date"`
	// DeliveryDate - Ngày giao hàng dự kiến (có thể null)
	DeliveryDate     *time.Time `json:"delivery_date"`
	// CompletedDate - Ngày hoàn thành thực tế (có thể null)
	CompletedDate    *time.Time `json:"completed_date"`
	// CreatedAt - Thời gian tạo phiếu trong hệ thống
	CreatedAt        time.Time  `json:"created_at"`
	// UpdatedAt - Thời gian cập nhật phiếu lần cuối
	UpdatedAt        time.Time  `json:"updated_at"`
}

// SalesInvoiceItem - Model chứa chi tiết sản phẩm trong phiếu bán hàng
// Mỗi item đại diện cho một sản phẩm cụ thể được bán
type SalesInvoiceItem struct {
	// ID - Mã định danh duy nhất của item trong phiếu
	ID              int32     `json:"id"`
	// InvoiceID - Mã phiếu bán hàng mà item này thuộc về
	InvoiceID       int32     `json:"invoice_id"`
	// ProductID - Mã sản phẩm được bán
	ProductID       int32     `json:"product_id"`
	// Quantity - Số lượng sản phẩm bán ra
	Quantity        int32     `json:"quantity"`
	// UnitPrice - Giá bán đơn vị của sản phẩm (dạng text để hỗ trợ decimal chính xác)
	UnitPrice       string    `json:"unit_price"`
	// TotalPrice - Tổng giá trị trước giảm giá (Quantity * UnitPrice)
	TotalPrice      string    `json:"total_price"`
	// DiscountPercent - Phần trăm giảm giá cho sản phẩm (có thể null)
	DiscountPercent string    `json:"discount_percent"`
	// DiscountAmount - Số tiền giảm giá cho sản phẩm (có thể null)
	DiscountAmount  string    `json:"discount_amount"`
	// FinalPrice - Giá cuối cùng sau giảm giá (dạng text)
	FinalPrice      string    `json:"final_price"`
	// Notes - Ghi chú đặc biệt cho sản phẩm này
	Notes           *string   `json:"notes"`
	// CreatedAt - Thời gian tạo item trong phiếu
	CreatedAt       time.Time `json:"created_at"`
	// UpdatedAt - Thời gian cập nhật item lần cuối
	UpdatedAt       time.Time `json:"updated_at"`
}

// ===== CÁC HẰNG SỐ CHO TRẠNG THÁI PHIẾU BÁN HÀNG =====

// SalesInvoiceStatus - Định nghĩa các trạng thái của phiếu bán hàng
// Quy trình: Draft -> Confirmed -> Delivered -> Completed (hoặc Cancelled)
const (
	// StatusDraft - Trạng thái nháp
	// Phiếu vừa được tạo, chưa xác nhận
	StatusDraft     = 1
	// StatusConfirmed - Trạng thái đã xác nhận
	// Phiếu đã được xác nhận và sẵn sàng xử lý
	StatusConfirmed = 2
	// StatusDelivered - Trạng thái đã giao hàng
	// Hàng đã được giao cho khách hàng
	StatusDelivered = 3
	// StatusCompleted - Trạng thái đã hoàn thành
	// Giao dịch hoàn tất, đã thanh toán và giao hàng
	StatusCompleted = 4
	// StatusCancelled - Trạng thái đã hủy
	// Phiếu bị hủy vì lý do nào đó
	StatusCancelled = 5
)

// ===== CÁC HẰNG SỐ CHO TRẠNG THÁI THANH TOÁN =====

// PaymentStatus - Định nghĩa các trạng thái thanh toán
const (
	// PaymentStatusUnpaid - Chưa thanh toán
	// Khách hàng chưa thanh toán gì
	PaymentStatusUnpaid     = 1
	// PaymentStatusPartial - Thanh toán một phần
	// Khách hàng đã thanh toán một phần số tiền
	PaymentStatusPartial    = 2
	// PaymentStatusPaid - Đã thanh toán đủ
	// Khách hàng đã thanh toán đủ số tiền
	PaymentStatusPaid       = 3
)

// ===== CÁC HẰNG SỐ CHO PHƯƠNG THỨC THANH TOÁN =====

// PaymentMethod - Định nghĩa các phương thức thanh toán
const (
	// PaymentMethodCash - Thanh toán bằng tiền mặt
	PaymentMethodCash        = "CASH"
	// PaymentMethodBankTransfer - Thanh toán chuyển khoản ngân hàng
	PaymentMethodBankTransfer = "BANK_TRANSFER"
	// PaymentMethodCard - Thanh toán bằng thẻ (credit/debit)
	PaymentMethodCard        = "CARD"
)

// ===== CÁC STRUCT DTO CHO API =====

// CreateSalesInvoiceRequest - Request DTO để tạo phiếu bán hàng mới
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
	PaymentMethod   string                       `json:"payment_method"`
	// DiscountAmount - Số tiền giảm giá tổng
	DiscountAmount  *string                      `json:"discount_amount"`
	// DeliveryDate - Ngày giao hàng dự kiến
	DeliveryDate    *time.Time                   `json:"delivery_date"`
	// Notes - Ghi chú
	Notes           *string                      `json:"notes"`
	// Items - Danh sách sản phẩm trong phiếu
	Items           []CreateSalesInvoiceItemRequest `json:"items" binding:"required,min=1"`
}

// CreateSalesInvoiceItemRequest - Request DTO để thêm sản phẩm vào phiếu
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

// UpdateSalesInvoiceRequest - Request DTO để cập nhật phiếu bán hàng
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

// UpdateSalesInvoiceItemRequest - Request DTO để cập nhật sản phẩm trong phiếu
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