package service

import (
	"context"
	inventoryVO "gn-farm-go-server/internal/vo/inventory"
	"gn-farm-go-server/pkg/response"
)

// IInventoryTransactionService interface cho service quản lý giao dịch kho với giá trung bình gia quyền
type IInventoryTransactionService interface {
	// Nhập kho với tính toán giá trung bình gia quyền
	ProcessStockIn(ctx context.Context, req *inventoryVO.StockInRequest) (*inventoryVO.StockInResponse, *response.ResponseData, error)
	
	// Xuất kho với cập nhật tồn kho theo FIFO
	ProcessStockOut(ctx context.Context, req *inventoryVO.StockOutRequest) (*inventoryVO.StockOutResponse, *response.ResponseData, error)
	
	// Tính toán lại giá trung bình cho sản phẩm
	RecalculateAverageCost(ctx context.Context, productID int32) (*inventoryVO.AverageCostResponse, *response.ResponseData, error)
	
	// Lấy lịch sử giao dịch kho của sản phẩm
	GetTransactionHistory(ctx context.Context, productID int32, req *inventoryVO.TransactionHistoryRequest) (*inventoryVO.TransactionHistoryResponse, *response.ResponseData, error)
	
	// Lấy thông tin chi tiết tồn kho theo lô
	GetInventoryBatches(ctx context.Context, productID int32) (*inventoryVO.InventoryBatchesResponse, *response.ResponseData, error)
	
	// Báo cáo giá trị tồn kho
	GetInventoryValueReport(ctx context.Context, req *inventoryVO.InventoryValueReportRequest) (*inventoryVO.InventoryValueReportResponse, *response.ResponseData, error)
	
	// Cảnh báo hàng tồn kho thấp
	GetLowStockAlert(ctx context.Context, threshold int32) (*inventoryVO.LowStockAlertResponse, *response.ResponseData, error)
	
	// Cảnh báo hàng hết hạn
	GetExpiredBatchesAlert(ctx context.Context) (*inventoryVO.ExpiredBatchesResponse, *response.ResponseData, error)
}

var (
	InventoryTransaction IInventoryTransactionService
)

func InitInventoryTransactionService(inventoryTransactionService IInventoryTransactionService) {
	InventoryTransaction = inventoryTransactionService
}