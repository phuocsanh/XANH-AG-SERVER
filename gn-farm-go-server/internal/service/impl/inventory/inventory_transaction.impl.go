package inventory

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/shopspring/decimal"

	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service"
	inventoryVO "gn-farm-go-server/internal/vo/inventory"
	"gn-farm-go-server/pkg/response"
)

// inventoryTransactionService - Implementation của service quản lý giao dịch tồn kho
type inventoryTransactionService struct {
	queries *database.Queries
}

// NewInventoryTransactionService - Tạo service mới cho giao dịch tồn kho
func NewInventoryTransactionService(queries *database.Queries) service.IInventoryTransactionService {
	return &inventoryTransactionService{
		queries: queries,
	}
}

// ProcessStockIn - Xử lý nhập kho với tính toán giá trung bình gia quyền
func (s *inventoryTransactionService) ProcessStockIn(ctx context.Context, req *inventoryVO.StockInRequest) (*inventoryVO.StockInResponse, *response.ResponseData, error) {
	// Lấy thông tin sản phẩm hiện tại
	product, err := s.queries.GetProductCostInfo(ctx, req.ProductID)
	if err == sql.ErrNoRows {
		return nil, &response.ResponseData{
			Code:    response.ErrCodeNotFound,
			Message: "Không tìm thấy sản phẩm",
			Data:    nil,
		}, fmt.Errorf("không tìm thấy sản phẩm với ID: %d", req.ProductID)
	}
	if err != nil {
		return nil, &response.ResponseData{
			Code:    response.ErrCodeInternalServerError,
			Message: "Lỗi khi lấy thông tin sản phẩm",
			Data:    nil,
		}, fmt.Errorf("lỗi khi lấy thông tin sản phẩm: %w", err)
	}

	// Kiểm tra sản phẩm có tồn tại không
	if product.ID == 0 {
		return nil, &response.ResponseData{
			Code:    response.ErrCodeNotFound,
			Message: "Sản phẩm không tồn tại",
			Data:    nil,
		}, fmt.Errorf("product not found")
	}

	// Lấy giao dịch tồn kho cuối cùng để tính toán
	lastTransaction, err := s.queries.GetLatestInventoryTransaction(ctx, req.ProductID)
	if err != nil && err != sql.ErrNoRows {
		return nil, &response.ResponseData{
			Code:    response.ErrCodeInternalServerError,
			Message: "Không thể lấy giao dịch cuối cùng",
			Data:    nil,
		}, err
	}

	// Tính toán giá trung bình gia quyền mới
	currentQuantity := decimal.NewFromInt(0)
	currentCost := decimal.NewFromFloat(0)
	if err != sql.ErrNoRows {
		currentQuantity = decimal.NewFromInt(int64(lastTransaction.RemainingQuantity))
		currentCost, _ = decimal.NewFromString(lastTransaction.NewAverageCost)
	}

	newQuantity := decimal.NewFromInt(int64(req.Quantity))
	newCost, _ := decimal.NewFromString(req.UnitCostPrice)

	// Tính tổng giá trị hiện tại và mới
	currentValue := currentQuantity.Mul(currentCost)
	newValue := newQuantity.Mul(newCost)
	totalValue := currentValue.Add(newValue)
	totalQuantity := currentQuantity.Add(newQuantity)

	// Tính giá trung bình gia quyền mới
	var newAverageCost decimal.Decimal
	if totalQuantity.IsZero() {
		newAverageCost = newCost
	} else {
		newAverageCost = totalValue.Div(totalQuantity)
	}

	// Tạo batch code nếu không có
	batchCode := ""
	if req.BatchCode != nil {
		batchCode = *req.BatchCode
	}
	if batchCode == "" {
		timestamp := time.Now().Format("20060102150405")
		batchCode = fmt.Sprintf("BATCH_%d_%s", req.ProductID, timestamp)
	}

	// Tạo inventory batch mới
	batchParams := database.CreateInventoryBatchParams{
		ProductID: req.ProductID,
		BatchCode: sql.NullString{String: batchCode, Valid: true},
		UnitCostPrice: req.UnitCostPrice,
		OriginalQuantity: req.Quantity,
		RemainingQuantity: req.Quantity,
		ExpiryDate: sql.NullTime{Time: time.Time{}, Valid: false},
		ReceiptItemID: sql.NullInt32{Int32: 0, Valid: false},
	}
	if req.ExpiryDate != nil {
		batchParams.ExpiryDate = sql.NullTime{Time: *req.ExpiryDate, Valid: true}
	}
	if req.ReceiptItemID != nil {
		batchParams.ReceiptItemID = sql.NullInt32{Int32: *req.ReceiptItemID, Valid: true}
	}

	batch, err := s.queries.CreateInventoryBatch(ctx, batchParams)
	if err != nil {
		return nil, &response.ResponseData{
			Code:    response.ErrCodeInternalServerError,
			Message: "Lỗi khi tạo lô hàng",
			Data:    nil,
		}, fmt.Errorf("lỗi khi tạo lô hàng: %w", err)
	}

	// Tính toán số lượng trước và sau giao dịch
	quantityBefore := int32(0)
	if err != sql.ErrNoRows {
		quantityBefore = lastTransaction.RemainingQuantity
	}
	newRemainingQuantity := quantityBefore + req.Quantity

	// Tính tổng giá trị giao dịch
	totalCostValue := newCost.Mul(newQuantity)

	transactionParams := database.CreateInventoryTransactionParams{
		ProductID:         req.ProductID,
		TransactionType:   "IN",
		Quantity:          req.Quantity,
		UnitCostPrice:     req.UnitCostPrice,
		TotalCostValue:    totalCostValue.String(),
		RemainingQuantity: newRemainingQuantity,
		NewAverageCost:    newAverageCost.String(),
		ReceiptItemID:     sql.NullInt32{Int32: 0, Valid: false},
		ReferenceType:     sql.NullString{String: "", Valid: false},
		ReferenceID:       sql.NullInt32{Int32: 0, Valid: false},
		Notes:             sql.NullString{String: "", Valid: false},
		CreatedByUserID:   req.CreatedByUserID,
	}
	if req.ReceiptItemID != nil {
		transactionParams.ReceiptItemID = sql.NullInt32{Int32: *req.ReceiptItemID, Valid: true}
	}
	if req.ReferenceType != nil && *req.ReferenceType != "" {
		transactionParams.ReferenceType = sql.NullString{String: *req.ReferenceType, Valid: true}
	}
	if req.ReferenceID != nil {
		transactionParams.ReferenceID = sql.NullInt32{Int32: *req.ReferenceID, Valid: true}
	}
	if req.Notes != nil && *req.Notes != "" {
		transactionParams.Notes = sql.NullString{String: *req.Notes, Valid: true}
	}

	transaction, err := s.queries.CreateInventoryTransaction(ctx, transactionParams)
	if err != nil {
		return nil, &response.ResponseData{
			Code:    response.ErrCodeInternalServerError,
			Message: "Lỗi khi tạo giao dịch",
			Data:    nil,
		}, fmt.Errorf("lỗi khi tạo giao dịch: %w", err)
	}

	// Cập nhật giá vốn trung bình và giá bán sản phẩm
	updateParams := database.UpdateProductAverageCostAndPriceParams{
		ID:               req.ProductID,
		AverageCostPrice: newAverageCost.String(),
	}

	err = s.queries.UpdateProductAverageCostAndPrice(ctx, updateParams)
	if err != nil {
		return nil, &response.ResponseData{
			Code:    response.ErrCodeInternalServerError,
			Message: "Lỗi khi cập nhật giá sản phẩm",
			Data:    nil,
		}, fmt.Errorf("lỗi khi cập nhật giá sản phẩm: %w", err)
	}

	// Trả về response
	return &inventoryVO.StockInResponse{
		TransactionID: transaction.ID,
		BatchID:       &batch.ID,
	}, &response.ResponseData{
		Code:    response.ErrCodeSuccess,
		Message: "Nhập kho thành công",
		Data:    nil,
	}, nil
}

// ProcessStockOut - Xử lý xuất kho theo phương pháp FIFO
func (s *inventoryTransactionService) ProcessStockOut(ctx context.Context, req *inventoryVO.StockOutRequest) (*inventoryVO.StockOutResponse, *response.ResponseData, error) {
	return nil, &response.ResponseData{
		Code:    response.ErrCodeInternalServerError,
		Message: "Chức năng chưa được triển khai",
		Data:    nil,
	}, fmt.Errorf("not implemented")
}

// RecalculateAverageCost - Tính lại giá trung bình cho sản phẩm
func (s *inventoryTransactionService) RecalculateAverageCost(ctx context.Context, productID int32) (*inventoryVO.AverageCostResponse, *response.ResponseData, error) {
	return nil, &response.ResponseData{
		Code:    response.ErrCodeInternalServerError,
		Message: "Chức năng chưa được triển khai",
		Data:    nil,
	}, fmt.Errorf("not implemented")
}

// GetTransactionHistory - Lấy lịch sử giao dịch tồn kho
func (s *inventoryTransactionService) GetTransactionHistory(ctx context.Context, productID int32, req *inventoryVO.TransactionHistoryRequest) (*inventoryVO.TransactionHistoryResponse, *response.ResponseData, error) {
	return nil, &response.ResponseData{
		Code:    response.ErrCodeInternalServerError,
		Message: "Chức năng chưa được triển khai",
		Data:    nil,
	}, fmt.Errorf("not implemented")
}

// GetInventoryBatches - Lấy thông tin các lô hàng
func (s *inventoryTransactionService) GetInventoryBatches(ctx context.Context, productID int32) (*inventoryVO.InventoryBatchesResponse, *response.ResponseData, error) {
	return nil, &response.ResponseData{
		Code:    response.ErrCodeInternalServerError,
		Message: "Chức năng chưa được triển khai",
		Data:    nil,
	}, fmt.Errorf("not implemented")
}

// GetInventoryValueReport - Lấy báo cáo giá trị tồn kho
func (s *inventoryTransactionService) GetInventoryValueReport(ctx context.Context, req *inventoryVO.InventoryValueReportRequest) (*inventoryVO.InventoryValueReportResponse, *response.ResponseData, error) {
	return nil, &response.ResponseData{
		Code:    response.ErrCodeInternalServerError,
		Message: "Chức năng chưa được triển khai",
		Data:    nil,
	}, fmt.Errorf("not implemented")
}

// GetLowStockAlert - Lấy cảnh báo tồn kho thấp
func (s *inventoryTransactionService) GetLowStockAlert(ctx context.Context, threshold int32) (*inventoryVO.LowStockAlertResponse, *response.ResponseData, error) {
	return nil, &response.ResponseData{
		Code:    response.ErrCodeInternalServerError,
		Message: "Chức năng chưa được triển khai",
		Data:    nil,
	}, fmt.Errorf("not implemented")
}

// GetExpiredBatchesAlert - Lấy cảnh báo hàng hết hạn
func (s *inventoryTransactionService) GetExpiredBatchesAlert(ctx context.Context) (*inventoryVO.ExpiredBatchesResponse, *response.ResponseData, error) {
	return nil, &response.ResponseData{
		Code:    response.ErrCodeInternalServerError,
		Message: "Chức năng chưa được triển khai",
		Data:    nil,
	}, fmt.Errorf("not implemented")
}