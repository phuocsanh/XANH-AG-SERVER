package inventory

import (
	"context"
	"fmt"
	"math"
	"time"

	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service"
	inventoryVO "gn-farm-go-server/internal/vo/inventory"
	"gn-farm-go-server/pkg/response"
)

type inventoryService struct {
	db *database.Queries
	inventoryTransactionService service.IInventoryTransactionService
}

func NewInventoryService(db *database.Queries, inventoryTransactionService service.IInventoryTransactionService) service.IInventoryService {
	return &inventoryService{
		db: db,
		inventoryTransactionService: inventoryTransactionService,
	}
}

// CreateInventoryReceipt tạo phiếu nhập kho mới
func (s *inventoryService) CreateInventoryReceipt(ctx context.Context, userID int32, req *inventoryVO.CreateInventoryReceiptRequest) (*inventoryVO.InventoryReceiptResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	// Tạm thởi trả về mock data
	result := &inventoryVO.InventoryReceiptResponse{
		ID:               1,
		ReceiptCode:      "IR-" + fmt.Sprintf("%d", time.Now().Unix()),
		SupplierName:     req.SupplierName,
		SupplierContact:  req.SupplierContact,
		CreatedByUserID:  userID,
		TotalAmount:      "0",
		TotalItems:       0,
		Status:           1, // pending
		StatusText:       "Chờ xử lý",
		ReceiptDate:      time.Now(),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
		Items:            []inventoryVO.InventoryReceiptItemResponse{},
	}
	
	return result, nil, nil
}

// GetInventoryReceipt lấy thông tin phiếu nhập kho theo ID
func (s *inventoryService) GetInventoryReceipt(ctx context.Context, id int32) (*inventoryVO.InventoryReceiptResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	result := &inventoryVO.InventoryReceiptResponse{
		ID:               id,
		ReceiptCode:      "IR-001",
		SupplierName:     stringPtr("Nhà cung cấp A"),
		SupplierContact:  stringPtr("0123456789"),
		CreatedByUserID:  1,
		TotalAmount:      "5000000",
		TotalItems:       100,
		Status:           1,
		StatusText:       "Chờ xử lý",
		ReceiptDate:      time.Now(),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
		Items:            []inventoryVO.InventoryReceiptItemResponse{},
	}
	
	return result, nil, nil
}

// GetInventoryReceiptByCode lấy thông tin phiếu nhập kho theo mã
func (s *inventoryService) GetInventoryReceiptByCode(ctx context.Context, code string) (*inventoryVO.InventoryReceiptResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	result := &inventoryVO.InventoryReceiptResponse{
		ID:               1,
		ReceiptCode:      code,
		SupplierName:     stringPtr("Nhà cung cấp A"),
		SupplierContact:  stringPtr("0123456789"),
		CreatedByUserID:  1,
		TotalAmount:      "5000000",
		TotalItems:       100,
		Status:           1,
		StatusText:       "Chờ xử lý",
		ReceiptDate:      time.Now(),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
		Items:            []inventoryVO.InventoryReceiptItemResponse{},
	}
	
	return result, nil, nil
}

// ListInventoryReceipts lấy danh sách phiếu nhập kho
func (s *inventoryService) ListInventoryReceipts(ctx context.Context, req *inventoryVO.ListInventoryReceiptsRequest) (*inventoryVO.ListInventoryReceiptsResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	receipts := []inventoryVO.InventoryReceiptResponse{
		{
			ID:               1,
			ReceiptCode:      "IR-001",
			SupplierName:     stringPtr("Nhà cung cấp A"),
			SupplierContact:  stringPtr("0123456789"),
			CreatedByUserID:  1,
			TotalAmount:      "5000000",
			TotalItems:       100,
			Status:           1,
			StatusText:       "Chờ xử lý",
			ReceiptDate:      time.Now(),
			CreatedAt:        time.Now(),
			UpdatedAt:        time.Now(),
		},
	}
	
	totalPages := int32(math.Ceil(float64(1) / float64(req.Limit)))
	
	result := &inventoryVO.ListInventoryReceiptsResponse{
		Data:       receipts,
		Total:      1,
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages,
	}
	
	return result, nil, nil
}

// UpdateInventoryReceipt cập nhật phiếu nhập kho
func (s *inventoryService) UpdateInventoryReceipt(ctx context.Context, id int32, req *inventoryVO.UpdateInventoryReceiptRequest) (*inventoryVO.InventoryReceiptResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	result := &inventoryVO.InventoryReceiptResponse{
		ID:               id,
		ReceiptCode:      "IR-001",
		SupplierName:     req.SupplierName,
		SupplierContact:  req.SupplierContact,
		CreatedByUserID:  1,
		TotalAmount:      "5000000",
		TotalItems:       100,
		Status:           1,
		StatusText:       "Chờ xử lý",
		ReceiptDate:      time.Now(),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
		Items:            []inventoryVO.InventoryReceiptItemResponse{},
	}
	
	return result, nil, nil
}

// DeleteInventoryReceipt xóa phiếu nhập kho
func (s *inventoryService) DeleteInventoryReceipt(ctx context.Context, id int32) (*response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	return nil, nil
}

// ApproveInventoryReceipt duyệt phiếu nhập kho
func (s *inventoryService) ApproveInventoryReceipt(ctx context.Context, id int32, req *inventoryVO.ApproveReceiptRequest) (*inventoryVO.InventoryReceiptResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	result := &inventoryVO.InventoryReceiptResponse{
		ID:               id,
		ReceiptCode:      "IR-001",
		SupplierName:     stringPtr("Nhà cung cấp A"),
		SupplierContact:  stringPtr("0123456789"),
		CreatedByUserID:  1,
		CheckedByUserID:  &req.ApprovedBy,
		TotalAmount:      "5000000",
		TotalItems:       100,
		Status:           2, // approved
		StatusText:       "Đã kiểm tra",
		ReceiptDate:      time.Now(),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
		Items:            []inventoryVO.InventoryReceiptItemResponse{},
	}
	
	return result, nil, nil
}

// CompleteInventoryReceipt hoàn thành phiếu nhập kho
func (s *inventoryService) CompleteInventoryReceipt(ctx context.Context, id int32, userID int32) (*inventoryVO.InventoryReceiptResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	result := &inventoryVO.InventoryReceiptResponse{
		ID:               id,
		ReceiptCode:      "IR-001",
		SupplierName:     stringPtr("Nhà cung cấp A"),
		SupplierContact:  stringPtr("0123456789"),
		CreatedByUserID:  1,
		CheckedByUserID:  &userID,
		TotalAmount:      "5000000",
		TotalItems:       100,
		Status:           3, // completed
		StatusText:       "Đã nhập kho",
		ReceiptDate:      time.Now(),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
		Items:            []inventoryVO.InventoryReceiptItemResponse{},
	}
	
	return result, nil, nil
}

// CancelInventoryReceipt hủy phiếu nhập kho
func (s *inventoryService) CancelInventoryReceipt(ctx context.Context, id int32, userID int32, reason string) (*inventoryVO.InventoryReceiptResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	result := &inventoryVO.InventoryReceiptResponse{
		ID:               id,
		ReceiptCode:      "IR-001",
		SupplierName:     stringPtr("Nhà cung cấp A"),
		SupplierContact:  stringPtr("0123456789"),
		CreatedByUserID:  1,
		TotalAmount:      "5000000",
		TotalItems:       100,
		Status:           4, // cancelled
		StatusText:       "Hủy",
		ReceiptDate:      time.Now(),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
		Items:            []inventoryVO.InventoryReceiptItemResponse{},
	}
	
	return result, nil, nil
}

// GetInventoryReceiptItems lấy danh sách sản phẩm trong phiếu nhập kho
func (s *inventoryService) GetInventoryReceiptItems(ctx context.Context, receiptID int32) ([]*inventoryVO.InventoryReceiptItemResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	items := []*inventoryVO.InventoryReceiptItemResponse{
		{
			ID:          1,
			ReceiptID:   receiptID,
			ProductID:   1,
			ProductName: stringPtr("Sản phẩm A"),
			Quantity:    100,
			UnitPrice:   "50000",
			TotalPrice:  "5000000",
			ExpiryDate:  nil,
			BatchNumber: stringPtr("BATCH001"),
			Notes:       stringPtr("Ghi chú"),
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		},
	}
	
	return items, nil, nil
}

// UpdateInventoryReceiptItem cập nhật sản phẩm trong phiếu nhập kho
func (s *inventoryService) UpdateInventoryReceiptItem(ctx context.Context, id int32, req *inventoryVO.UpdateInventoryReceiptItemRequest) (*inventoryVO.InventoryReceiptItemResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	result := &inventoryVO.InventoryReceiptItemResponse{
		ID:          id,
		ReceiptID:   1,
		ProductID:   1, // mock value
		ProductName: stringPtr("Sản phẩm A"),
		Quantity:    getInt32Value(req.Quantity),
		UnitPrice:   getStringValue(req.UnitPrice),
		TotalPrice:  "5000000", // mock calculated value
		ExpiryDate:  req.ExpiryDate,
		BatchNumber: req.BatchNumber,
		Notes:       req.Notes,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	
	return result, nil, nil
}

// DeleteInventoryReceiptItem xóa sản phẩm khỏi phiếu nhập kho
func (s *inventoryService) DeleteInventoryReceiptItem(ctx context.Context, id int32) (*response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	return nil, nil
}

// GetInventoryHistory lấy lịch sử tồn kho
func (s *inventoryService) GetInventoryHistory(ctx context.Context, req *inventoryVO.GetInventoryHistoryRequest) (*inventoryVO.GetInventoryHistoryResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	histories := []inventoryVO.InventoryHistoryResponse{
		{
			ID:               1,
			ProductID:        req.ProductID,
			ProductName:      stringPtr("Sản phẩm A"),
			ReceiptItemID:    int32Ptr(1),
			ChangeType:       "in",
			ChangeTypeText:   "Nhập kho",
			QuantityBefore:   0,
			QuantityChange:   100,
			QuantityAfter:    100,
			UnitPrice:        stringPtr("50000"),
			Reason:           stringPtr("Nhập kho từ phiếu IR-001"),
			CreatedByUserID:  1,
			CreatedAt:        time.Now(),
		},
	}
	
	result := &inventoryVO.GetInventoryHistoryResponse{
		Histories: histories,
		Total:     1,
		Page:      req.Page,
		Limit:     req.Limit,
	}
	
	return result, nil, nil
}

// ProcessStockIn - Xử lý nhập kho với tính toán giá trung bình gia quyền
// Delegate call tới inventoryTransactionService
func (s *inventoryService) ProcessStockIn(ctx context.Context, req *inventoryVO.StockInRequest) (*inventoryVO.StockInResponse, *response.ResponseData, error) {
	return s.inventoryTransactionService.ProcessStockIn(ctx, req)
}

// Helper functions
func stringPtr(s string) *string {
	return &s
}

func int32Ptr(i int32) *int32 {
	return &i
}

func getStringValue(ptr *string) string {
	if ptr != nil {
		return *ptr
	}
	return ""
}

func getInt32Value(ptr *int32) int32 {
	if ptr != nil {
		return *ptr
	}
	return 0
}
