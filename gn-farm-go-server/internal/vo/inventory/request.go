package inventory

import "time"

// CreateInventoryReceiptRequest yêu cầu tạo phiếu nhập kho
type CreateInventoryReceiptRequest struct {
	SupplierName    *string                        `json:"supplierName" validate:"omitempty,max=200"`
	SupplierContact *string                        `json:"supplierContact" validate:"omitempty,max=100"`
	CheckedByUserID *int32                         `json:"checkedByUserId"`
	Notes           *string                        `json:"notes"`
	ReceiptDate     *time.Time                     `json:"receiptDate"`
	Items           []CreateInventoryReceiptItemRequest `json:"items" validate:"required,min=1"`
}

// CreateInventoryReceiptItemRequest yêu cầu tạo chi tiết sản phẩm trong phiếu nhập
type CreateInventoryReceiptItemRequest struct {
	ProductID   int32      `json:"productId" validate:"required,min=1"`
	Quantity    int32      `json:"quantity" validate:"required,min=1"`
	UnitPrice   string     `json:"unitPrice" validate:"required"`
	ExpiryDate  *time.Time `json:"expiryDate"`
	BatchNumber *string    `json:"batchNumber" validate:"omitempty,max=100"`
	Notes       *string    `json:"notes"`
}

// UpdateInventoryReceiptRequest yêu cầu cập nhật phiếu nhập kho
type UpdateInventoryReceiptRequest struct {
	SupplierName    *string `json:"supplierName" validate:"omitempty,max=200"`
	SupplierContact *string `json:"supplierContact" validate:"omitempty,max=100"`
	CheckedByUserID *int32  `json:"checkedByUserId"`
	Notes           *string `json:"notes"`
	Status          *int32  `json:"status" validate:"omitempty,min=1,max=4"`
}

// UpdateInventoryReceiptItemRequest yêu cầu cập nhật chi tiết sản phẩm
type UpdateInventoryReceiptItemRequest struct {
	Quantity    *int32     `json:"quantity" validate:"omitempty,min=1"`
	UnitPrice   *string    `json:"unitPrice"`
	ExpiryDate  *time.Time `json:"expiryDate"`
	BatchNumber *string    `json:"batchNumber" validate:"omitempty,max=100"`
	Notes       *string    `json:"notes"`
}

// ListInventoryReceiptsRequest yêu cầu lấy danh sách phiếu nhập kho
type ListInventoryReceiptsRequest struct {
	SupplierName *string    `json:"supplierName" form:"supplierName"`
	Status       *int32     `json:"status" form:"status" validate:"omitempty,min=1,max=4"`
	FromDate     *time.Time `json:"fromDate" form:"fromDate"`
	ToDate       *time.Time `json:"toDate" form:"toDate"`
	Page         int32      `json:"page" form:"page" validate:"min=1"`
	Limit        int32      `json:"limit" form:"limit" validate:"min=1,max=100"`
}

// GetInventoryHistoryRequest yêu cầu lấy lịch sử tồn kho
type GetInventoryHistoryRequest struct {
	ProductID int32 `json:"productId" form:"productId" validate:"required,min=1"`
	Page      int32 `json:"page" form:"page" validate:"min=1"`
	Limit     int32 `json:"limit" form:"limit" validate:"min=1,max=100"`
}

// ApproveReceiptRequest - Request duyệt phiếu nhập kho
type ApproveReceiptRequest struct {
	ApprovedBy int32  `json:"approvedBy" binding:"required" example:"1"`        // ID người duyệt
	Notes      string `json:"notes" example:"Phiếu nhập đã được kiểm tra và duyệt"` // Ghi chú khi duyệt
}

// ApproveReceiptRequest yêu cầu duyệt phiếu nhập kho
type ApproveReceiptRequestOld struct {
	CheckedByUserID int32   `json:"checkedByUserId" validate:"required,min=1"`
	Notes           *string `json:"notes"`
}

// StockInRequest yêu cầu nhập kho với tính giá trung bình gia quyền
type StockInRequest struct {
	ProductID       int32      `json:"productId" validate:"required,min=1"`
	Quantity        int32      `json:"quantity" validate:"required,min=1"`
	UnitCostPrice   string     `json:"unitCostPrice" validate:"required"`
	BatchCode       *string    `json:"batchCode" validate:"omitempty,max=100"`
	ExpiryDate      *time.Time `json:"expiryDate"`
	ReceiptItemID   *int32     `json:"receiptItemId"`
	ReferenceType   *string    `json:"referenceType" validate:"omitempty,max=50"`
	ReferenceID     *int32     `json:"referenceId"`
	Notes           *string    `json:"notes"`
	CreatedByUserID int32      `json:"createdByUserId" validate:"required,min=1"`
}

// StockOutRequest yêu cầu xuất kho theo FIFO
type StockOutRequest struct {
	ProductID       int32   `json:"productId" validate:"required,min=1"`
	Quantity        int32   `json:"quantity" validate:"required,min=1"`
	ReferenceType   *string `json:"referenceType" validate:"omitempty,max=50"`
	ReferenceID     *int32  `json:"referenceId"`
	Notes           *string `json:"notes"`
	CreatedByUserID int32   `json:"createdByUserId" validate:"required,min=1"`
}

// TransactionHistoryRequest yêu cầu lấy lịch sử giao dịch kho
type TransactionHistoryRequest struct {
	TransactionType *string    `json:"transactionType" form:"transactionType" validate:"omitempty,oneof=IN OUT"`
	FromDate        *time.Time `json:"fromDate" form:"fromDate"`
	ToDate          *time.Time `json:"toDate" form:"toDate"`
	Page            int32      `json:"page" form:"page" validate:"min=1"`
	Limit           int32      `json:"limit" form:"limit" validate:"min=1,max=100"`
}

// InventoryValueReportRequest yêu cầu báo cáo giá trị tồn kho
type InventoryValueReportRequest struct {
	ProductName *string `json:"productName" form:"productName"`
	Page        int32   `json:"page" form:"page" validate:"min=1"`
	Limit       int32   `json:"limit" form:"limit" validate:"min=1,max=100"`
}
