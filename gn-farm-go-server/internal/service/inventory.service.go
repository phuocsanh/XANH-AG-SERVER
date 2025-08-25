package service

import (
	"context"
	inventoryVO "gn-farm-go-server/internal/vo/inventory"
	"gn-farm-go-server/pkg/response"
)

// IInventoryService interface cho service quản lý nhập hàng kho
type IInventoryService interface {
	// Quản lý phiếu nhập kho
	CreateInventoryReceipt(ctx context.Context, userID int32, req *inventoryVO.CreateInventoryReceiptRequest) (*inventoryVO.InventoryReceiptResponse, *response.ResponseData, error)
	GetInventoryReceipt(ctx context.Context, id int32) (*inventoryVO.InventoryReceiptResponse, *response.ResponseData, error)
	GetInventoryReceiptByCode(ctx context.Context, code string) (*inventoryVO.InventoryReceiptResponse, *response.ResponseData, error)
	ListInventoryReceipts(ctx context.Context, req *inventoryVO.ListInventoryReceiptsRequest) (*inventoryVO.ListInventoryReceiptsResponse, *response.ResponseData, error)
	UpdateInventoryReceipt(ctx context.Context, id int32, req *inventoryVO.UpdateInventoryReceiptRequest) (*inventoryVO.InventoryReceiptResponse, *response.ResponseData, error)
	DeleteInventoryReceipt(ctx context.Context, id int32) (*response.ResponseData, error)

	// Duyệt và xử lý phiếu nhập kho
	ApproveInventoryReceipt(ctx context.Context, id int32, req *inventoryVO.ApproveReceiptRequest) (*inventoryVO.InventoryReceiptResponse, *response.ResponseData, error)
	CompleteInventoryReceipt(ctx context.Context, id int32, userID int32) (*inventoryVO.InventoryReceiptResponse, *response.ResponseData, error)
	CancelInventoryReceipt(ctx context.Context, id int32, userID int32, reason string) (*inventoryVO.InventoryReceiptResponse, *response.ResponseData, error)

	// Quản lý chi tiết sản phẩm trong phiếu nhập
	GetInventoryReceiptItems(ctx context.Context, receiptID int32) ([]*inventoryVO.InventoryReceiptItemResponse, *response.ResponseData, error)
	UpdateInventoryReceiptItem(ctx context.Context, id int32, req *inventoryVO.UpdateInventoryReceiptItemRequest) (*inventoryVO.InventoryReceiptItemResponse, *response.ResponseData, error)
	DeleteInventoryReceiptItem(ctx context.Context, id int32) (*response.ResponseData, error)

	// Lịch sử tồn kho
	GetInventoryHistory(ctx context.Context, req *inventoryVO.GetInventoryHistoryRequest) (*inventoryVO.GetInventoryHistoryResponse, *response.ResponseData, error)

	// Nhập kho trực tiếp với tính giá trung bình gia quyền
	ProcessStockIn(ctx context.Context, req *inventoryVO.StockInRequest) (*inventoryVO.StockInResponse, *response.ResponseData, error)
}

var (
	Inventory IInventoryService
)

func InitInventoryService(inventoryService IInventoryService) {
	Inventory = inventoryService
}
