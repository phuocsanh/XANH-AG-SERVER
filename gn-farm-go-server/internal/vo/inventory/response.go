package inventory

import (
	"time"
	"gn-farm-go-server/internal/model/inventory"
)

// InventoryReceiptResponse phản hồi thông tin phiếu nhập kho
type InventoryReceiptResponse struct {
	ID               int32                         `json:"id"`
	ReceiptCode      string                        `json:"receiptCode"`
	SupplierName     *string                       `json:"supplierName"`
	SupplierContact  *string                       `json:"supplierContact"`
	CreatedByUserID  int32                         `json:"createdByUserId"`
	CheckedByUserID  *int32                        `json:"checkedByUserId"`
	TotalAmount      string                        `json:"totalAmount"`
	TotalItems       int32                         `json:"totalItems"`
	Notes            *string                       `json:"notes"`
	Status           int32                         `json:"status"`
	StatusText       string                        `json:"statusText"`
	ReceiptDate      time.Time                     `json:"receiptDate"`
	CreatedAt        time.Time                     `json:"createdAt"`
	UpdatedAt        time.Time                     `json:"updatedAt"`
	Items            []InventoryReceiptItemResponse `json:"items,omitempty"`
}

// InventoryReceiptItemResponse phản hồi chi tiết sản phẩm trong phiếu nhập
type InventoryReceiptItemResponse struct {
	ID          int32      `json:"id"`
	ReceiptID   int32      `json:"receiptId"`
	ProductID   int32      `json:"productId"`
	ProductName *string    `json:"productName,omitempty"`
	Quantity    int32      `json:"quantity"`
	UnitPrice   string     `json:"unitPrice"`
	TotalPrice  string     `json:"totalPrice"`
	ExpiryDate  *time.Time `json:"expiryDate"`
	BatchNumber *string    `json:"batchNumber"`
	Notes       *string    `json:"notes"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

// InventoryHistoryResponse phản hồi lịch sử tồn kho
type InventoryHistoryResponse struct {
	ID               int32     `json:"id"`
	ProductID        int32     `json:"productId"`
	ProductName      *string   `json:"productName,omitempty"`
	ReceiptItemID    *int32    `json:"receiptItemId"`
	ChangeType       string    `json:"changeType"`
	ChangeTypeText   string    `json:"changeTypeText"`
	QuantityBefore   int32     `json:"quantityBefore"`
	QuantityChange   int32     `json:"quantityChange"`
	QuantityAfter    int32     `json:"quantityAfter"`
	UnitPrice        *string   `json:"unitPrice"`
	Reason           *string   `json:"reason"`
	CreatedByUserID  int32     `json:"createdByUserId"`
	CreatedAt        time.Time `json:"createdAt"`
}

// ListInventoryReceiptsResponse phản hồi danh sách phiếu nhập kho
type ListInventoryReceiptsResponse struct {
	Data       []InventoryReceiptResponse `json:"data"`
	Total      int64                      `json:"total"`
	Page       int32                      `json:"page"`
	Limit      int32                      `json:"limit"`
	TotalPages int32                      `json:"totalPages"`
}

// ListInventoryHistoryResponse phản hồi danh sách lịch sử tồn kho
type ListInventoryHistoryResponse struct {
	Data       []InventoryHistoryResponse `json:"data"`
	Total      int64                      `json:"total"`
	Page       int32                      `json:"page"`
	Limit      int32                      `json:"limit"`
	TotalPages int32                      `json:"totalPages"`
}

// GetInventoryHistoryResponse phản hồi lịch sử tồn kho theo sản phẩm
type GetInventoryHistoryResponse struct {
	Histories []InventoryHistoryResponse `json:"histories"`
	Total     int64                      `json:"total"`
	Page      int32                      `json:"page"`
	Limit     int32                      `json:"limit"`
}

// GetStatusText trả về text mô tả trạng thái
func GetStatusText(status int32) string {
	switch status {
	case inventory.StatusPending:
		return "Chờ xử lý"
	case inventory.StatusChecked:
		return "Đã kiểm tra"
	case inventory.StatusCompleted:
		return "Đã nhập kho"
	case inventory.StatusCancelled:
		return "Hủy"
	default:
		return "Không xác định"
	}
}

// GetChangeTypeText trả về text mô tả loại thay đổi
func GetChangeTypeText(changeType string) string {
	switch changeType {
	case inventory.ChangeTypeIn:
		return "Nhập kho"
	case inventory.ChangeTypeOut:
		return "Xuất kho"
	case inventory.ChangeTypeAdjust:
		return "Điều chỉnh"
	default:
		return "Không xác định"
	}
}

// StockInResponse phản hồi nhập kho với giá trung bình gia quyền
type StockInResponse struct {
	TransactionID       int32   `json:"transactionId"`
	ProductID           int32   `json:"productId"`
	ProductName         string  `json:"productName"`
	QuantityAdded       int32   `json:"quantityAdded"`
	UnitCostPrice       string  `json:"unitCostPrice"`
	PreviousQuantity    int32   `json:"previousQuantity"`
	NewQuantity         int32   `json:"newQuantity"`
	PreviousAverageCost string  `json:"previousAverageCost"`
	NewAverageCost      string  `json:"newAverageCost"`
	NewSellingPrice     string  `json:"newSellingPrice"`
	ProfitMargin        string  `json:"profitMargin"`
	BatchID             *int32  `json:"batchId,omitempty"`
	CreatedAt           time.Time `json:"createdAt"`
}

// StockOutResponse phản hồi xuất kho
type StockOutResponse struct {
	TransactionID    int32                    `json:"transactionId"`
	ProductID        int32                    `json:"productId"`
	ProductName      string                   `json:"productName"`
	QuantityRemoved  int32                    `json:"quantityRemoved"`
	PreviousQuantity int32                    `json:"previousQuantity"`
	NewQuantity      int32                    `json:"newQuantity"`
	BatchesUsed      []BatchUsageInfo         `json:"batchesUsed"`
	CreatedAt        time.Time                `json:"createdAt"`
}

// BatchUsageInfo thông tin lô hàng được sử dụng khi xuất kho
type BatchUsageInfo struct {
	BatchID       int32  `json:"batchId"`
	BatchCode     string `json:"batchCode"`
	QuantityUsed  int32  `json:"quantityUsed"`
	UnitCostPrice string `json:"unitCostPrice"`
}

// AverageCostResponse phản hồi tính toán giá trung bình
type AverageCostResponse struct {
	ProductID           int32  `json:"productId"`
	ProductName         string `json:"productName"`
	TotalQuantity       int32  `json:"totalQuantity"`
	WeightedAverageCost string `json:"weightedAverageCost"`
	NewSellingPrice     string `json:"newSellingPrice"`
	ProfitMargin        string `json:"profitMargin"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

// InventoryTransactionResponse phản hồi giao dịch kho
type InventoryTransactionResponse struct {
	ID                int32     `json:"id"`
	ProductID         int32     `json:"productId"`
	ProductName       *string   `json:"productName,omitempty"`
	TransactionType   string    `json:"transactionType"`
	Quantity          int32     `json:"quantity"`
	UnitCostPrice     string    `json:"unitCostPrice"`
	TotalCostValue    string    `json:"totalCostValue"`
	RemainingQuantity int32     `json:"remainingQuantity"`
	NewAverageCost    string    `json:"newAverageCost"`
	ReceiptItemID     *int32    `json:"receiptItemId,omitempty"`
	ReferenceType     *string   `json:"referenceType,omitempty"`
	ReferenceID       *int32    `json:"referenceId,omitempty"`
	Notes             *string   `json:"notes,omitempty"`
	CreatedByUserID   int32     `json:"createdByUserId"`
	CreatedAt         time.Time `json:"createdAt"`
}

// TransactionHistoryResponse phản hồi lịch sử giao dịch kho
type TransactionHistoryResponse struct {
	Data       []InventoryTransactionResponse `json:"data"`
	Total      int64                          `json:"total"`
	Page       int32                          `json:"page"`
	Limit      int32                          `json:"limit"`
	TotalPages int32                          `json:"totalPages"`
}

// InventoryBatchResponse phản hồi thông tin lô hàng
type InventoryBatchResponse struct {
	ID                int32      `json:"id"`
	ProductID         int32      `json:"productId"`
	BatchCode         string     `json:"batchCode"`
	UnitCostPrice     string     `json:"unitCostPrice"`
	OriginalQuantity  int32      `json:"originalQuantity"`
	RemainingQuantity int32      `json:"remainingQuantity"`
	ExpiryDate        *time.Time `json:"expiryDate,omitempty"`
	ReceiptItemID     *int32     `json:"receiptItemId,omitempty"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
}

// InventoryBatchesResponse phản hồi danh sách lô hàng
type InventoryBatchesResponse struct {
	ProductID   int32                     `json:"productId"`
	ProductName string                    `json:"productName"`
	Batches     []InventoryBatchResponse  `json:"batches"`
	TotalBatches int32                    `json:"totalBatches"`
}

// InventoryValueItem thông tin giá trị tồn kho của một sản phẩm
type InventoryValueItem struct {
	ProductID           int32  `json:"productId"`
	ProductName         string `json:"productName"`
	AverageCostPrice    string `json:"averageCostPrice"`
	QuantityInStock     int32  `json:"quantityInStock"`
	BatchTotalQuantity  int32  `json:"batchTotalQuantity"`
	TotalInventoryValue string `json:"totalInventoryValue"`
}

// InventoryValueReportResponse phản hồi báo cáo giá trị tồn kho
type InventoryValueReportResponse struct {
	Data           []InventoryValueItem `json:"data"`
	TotalValue     string               `json:"totalValue"`
	TotalProducts  int32                `json:"totalProducts"`
	Page           int32                `json:"page"`
	Limit          int32                `json:"limit"`
	TotalPages     int32                `json:"totalPages"`
}

// LowStockItem thông tin sản phẩm tồn kho thấp
type LowStockItem struct {
	ProductID        int32  `json:"productId"`
	ProductName      string `json:"productName"`
	CurrentQuantity  int32  `json:"currentQuantity"`
	ActualStock      int32  `json:"actualStock"`
	AverageCostPrice string `json:"averageCostPrice"`
}

// LowStockAlertResponse phản hồi cảnh báo tồn kho thấp
type LowStockAlertResponse struct {
	Threshold    int32           `json:"threshold"`
	LowStockItems []LowStockItem `json:"lowStockItems"`
	TotalItems   int32           `json:"totalItems"`
}

// ExpiredBatchItem thông tin lô hàng hết hạn
type ExpiredBatchItem struct {
	BatchID           int32      `json:"batchId"`
	ProductID         int32      `json:"productId"`
	ProductName       string     `json:"productName"`
	BatchCode         string     `json:"batchCode"`
	RemainingQuantity int32      `json:"remainingQuantity"`
	UnitCostPrice     string     `json:"unitCostPrice"`
	ExpiryDate        *time.Time `json:"expiryDate"`
	DaysOverdue       int32      `json:"daysOverdue"`
}

// ExpiredBatchesResponse phản hồi cảnh báo hàng hết hạn
type ExpiredBatchesResponse struct {
	ExpiredBatches []ExpiredBatchItem `json:"expiredBatches"`
	TotalBatches   int32              `json:"totalBatches"`
	TotalValue     string             `json:"totalValue"`
}
