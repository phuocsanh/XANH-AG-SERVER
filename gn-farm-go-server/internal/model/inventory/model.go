// Package inventory - Chứa các model liên quan đến quản lý kho hàng
// Bao gồm phiếu nhập kho, chi tiết sản phẩm và lịch sử thay đổi tồn kho
package inventory

import (
	"time"
)

// InventoryReceipt - Model chứa thông tin phiếu nhập kho
// Quản lý toàn bộ quy trình nhập hàng từ nhà cung cấp
// Bao gồm các trạng thái: Chờ xử lý -> Đã kiểm tra -> Đã nhập kho -> Hủy
type InventoryReceipt struct {
	// ID - Mã định danh duy nhất của phiếu nhập
	ID               int32     `json:"id"`
	// ReceiptCode - Mã phiếu nhập (tự sinh hoặc nhập thủ công)
	ReceiptCode      string    `json:"receipt_code"`
	// SupplierName - Tên nhà cung cấp (có thể null)
	SupplierName     *string   `json:"supplier_name"`
	// SupplierContact - Thông tin liên hệ nhà cung cấp (số điện thoại, email)
	SupplierContact  *string   `json:"supplier_contact"`
	// CreatedByUserID - ID của người dùng tạo phiếu nhập
	CreatedByUserID  int32     `json:"created_by_user_id"`
	// CheckedByUserID - ID của người dùng kiểm tra phiếu (có thể null nếu chưa kiểm tra)
	CheckedByUserID  *int32    `json:"checked_by_user_id"`
	// TotalAmount - Tổng giá trị phiếu nhập (dạng text để hỗ trợ số lớn)
	TotalAmount      string    `json:"total_amount"`
	// TotalItems - Tổng số mặt hàng trong phiếu
	TotalItems       int32     `json:"total_items"`
	// Notes - Ghi chú thêm cho phiếu nhập
	Notes            *string   `json:"notes"`
	// Status - Trạng thái hiện tại của phiếu (1: Chờ xử lý, 2: Đã kiểm tra, 3: Đã nhập kho, 4: Hủy)
	Status           int32     `json:"status"`
	// ReceiptDate - Ngày nhập hàng thực tế
	ReceiptDate      time.Time `json:"receipt_date"`
	// CreatedAt - Thời gian tạo phiếu trong hệ thống
	CreatedAt        time.Time `json:"created_at"`
	// UpdatedAt - Thời gian cập nhật phiếu lần cuối
	UpdatedAt        time.Time `json:"updated_at"`
}

// InventoryReceiptItem - Model chứa chi tiết sản phẩm trong phiếu nhập
// Mỗi item đại diện cho một sản phẩm cụ thể được nhập vào kho
type InventoryReceiptItem struct {
	// ID - Mã định danh duy nhất của item trong phiếu
	ID          int32      `json:"id"`
	// ReceiptID - Mã phiếu nhập mà item này thuộc về
	ReceiptID   int32      `json:"receipt_id"`
	// ProductID - Mã sản phẩm được nhập
	ProductID   int32      `json:"product_id"`
	// Quantity - Số lượng sản phẩm nhập vào kho
	Quantity    int32      `json:"quantity"`
	// UnitPrice - Giá nhập đơn vị của sản phẩm (dạng text để hỗ trợ decimal chính xác)
	UnitPrice   string     `json:"unit_price"`
	// TotalPrice - Tổng giá trị của item (Quantity * UnitPrice)
	TotalPrice  string     `json:"total_price"`
	// ExpiryDate - Ngày hết hạn của sản phẩm (có thể null nếu không có)
	ExpiryDate  *time.Time `json:"expiry_date"`
	// BatchNumber - Số lô của sản phẩm (có thể null)
	BatchNumber *string    `json:"batch_number"`
	// Notes - Ghi chú đặc biệt cho sản phẩm này
	Notes       *string    `json:"notes"`
	// CreatedAt - Thời gian tạo item trong phiếu
	CreatedAt   time.Time  `json:"created_at"`
	// UpdatedAt - Thời gian cập nhật item lần cuối
	UpdatedAt   time.Time  `json:"updated_at"`
}

// InventoryHistory - Model chứa lịch sử thay đổi tồn kho
// Ghi lại mọi thao tác nhập/xuất/điều chỉnh kho hàng
type InventoryHistory struct {
	// ID - Mã định danh duy nhất của bản ghi lịch sử
	ID               int32     `json:"id"`
	// ProductID - Mã sản phẩm có thay đổi tồn kho
	ProductID        int32     `json:"product_id"`
	// ReceiptItemID - Mã item phiếu nhập liên quan (có thể null nếu không phải từ phiếu)
	ReceiptItemID    *int32    `json:"receipt_item_id"`
	// ChangeType - Loại thay đổi: 'IN' (nhập), 'OUT' (xuất), 'ADJUST' (điều chỉnh)
	ChangeType       string    `json:"change_type"`
	// QuantityBefore - Số lượng tồn kho trước khi thay đổi
	QuantityBefore   int32     `json:"quantity_before"`
	// QuantityChange - Số lượng thay đổi (dương nếu nhập, âm nếu xuất)
	QuantityChange   int32     `json:"quantity_change"`
	// QuantityAfter - Số lượng tồn kho sau khi thay đổi
	QuantityAfter    int32     `json:"quantity_after"`
	// UnitPrice - Giá đơn vị tại thời điểm thay đổi (có thể null)
	UnitPrice        *string   `json:"unit_price"`
	// Reason - Lý do thay đổi tồn kho
	Reason           *string   `json:"reason"`
	// CreatedByUserID - ID người dùng thực hiện thay đổi
	CreatedByUserID  int32     `json:"created_by_user_id"`
	// CreatedAt - Thời gian xảy ra thay đổi
	CreatedAt        time.Time `json:"created_at"`
}

// ===== CÁC HẰNG SỐ CHO TRẠNG THÁI PHIẾU NHẬP =====

// InventoryReceiptStatus - Định nghĩa các trạng thái của phiếu nhập kho
// Quy trình: Pending -> Checked -> Completed (hoặc Cancelled)
const (
	// StatusPending - Trạng thái chờ xử lý
	// Phiếu vừa được tạo, chưa có ai kiểm tra
	StatusPending   = 1
	// StatusChecked - Trạng thái đã kiểm tra
	// Phiếu đã được kiểm tra và xác nhận thông tin
	StatusChecked   = 2
	// StatusCompleted - Trạng thái đã hoàn thành
	// Hàng đã nhập kho và cập nhật tồn kho
	StatusCompleted = 3
	// StatusCancelled - Trạng thái đã hủy
	// Phiếu bị hủy vì lý do nào đó
	StatusCancelled = 4
)

// ===== CÁC HẰNG SỐ CHO LOẠI THAY ĐỔI TỒN KHO =====

// InventoryChangeType - Định nghĩa các loại thay đổi tồn kho
const (
	// ChangeTypeIn - Nhập kho
	// Tăng số lượng tồn kho khi nhập hàng mới
	ChangeTypeIn     = "IN"
	// ChangeTypeOut - Xuất kho  
	// Giảm số lượng tồn kho khi bán hoặc xuất hàng
	ChangeTypeOut    = "OUT"
	// ChangeTypeAdjust - Điều chỉnh kho
	// Điều chỉnh số lượng khi phát hiện sai lệch, hư hỏng, etc.
	ChangeTypeAdjust = "ADJUST"
)
