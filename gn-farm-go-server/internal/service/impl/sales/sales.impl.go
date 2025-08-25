package sales

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"time"

	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service"
	salesVO "gn-farm-go-server/internal/vo/sales"
	inventoryVO "gn-farm-go-server/internal/vo/inventory"
	"gn-farm-go-server/pkg/response"
	"gn-farm-go-server/internal/model"
)

type salesService struct {
	db *database.Queries
}

// NewSalesService tạo instance mới của sales service
func NewSalesService(db *database.Queries) service.ISalesService {
	return &salesService{
		db: db,
	}
}

// ===== UTILITY FUNCTIONS =====

// stringPtr trả về pointer của string
func stringPtr(s string) *string {
	return &s
}

// int32Ptr trả về pointer của int32
func int32Ptr(i int32) *int32 {
	return &i
}

// timePtr trả về pointer của time
func timePtr(t time.Time) *time.Time {
	return &t
}

// generateInvoiceCode tạo mã phiếu bán hàng tự động
func (s *salesService) generateInvoiceCode() string {
	return "SI-" + fmt.Sprintf("%d", time.Now().Unix())
}

// calculateItemPrice tính toán giá của một item
func (s *salesService) calculateItemPrice(quantity int32, unitPrice string, discountPercent, discountAmount *string) (string, string, string, error) {
	// Parse unit price
	unitPriceFloat, err := strconv.ParseFloat(unitPrice, 64)
	if err != nil {
		return "", "", "", fmt.Errorf("invalid unit price: %s", unitPrice)
	}
	
	// Tính total price trước giảm giá
	totalPrice := float64(quantity) * unitPriceFloat
	totalPriceStr := fmt.Sprintf("%.2f", totalPrice)
	
	// Tính giảm giá
	var discountAmountFloat float64 = 0
	
	if discountPercent != nil && *discountPercent != "" {
		// Nếu có phần trăm giảm giá
		percent, err := strconv.ParseFloat(*discountPercent, 64)
		if err == nil && percent >= 0 && percent <= 100 {
			discountAmountFloat = totalPrice * percent / 100
		}
	} else if discountAmount != nil && *discountAmount != "" {
		// Nếu có số tiền giảm giá cụ thể
		discount, err := strconv.ParseFloat(*discountAmount, 64)
		if err == nil && discount >= 0 {
			discountAmountFloat = discount
		}
	}
	
	// Đảm bảo giảm giá không vượt quá tổng tiền
	if discountAmountFloat > totalPrice {
		discountAmountFloat = totalPrice
	}
	
	discountAmountStr := fmt.Sprintf("%.2f", discountAmountFloat)
	finalPrice := totalPrice - discountAmountFloat
	finalPriceStr := fmt.Sprintf("%.2f", finalPrice)
	
	return totalPriceStr, discountAmountStr, finalPriceStr, nil
}

// ===== PHIẾU BÁN HÀNG =====

// CreateSalesInvoice tạo phiếu bán hàng mới
func (s *salesService) CreateSalesInvoice(ctx context.Context, userID int32, req *salesVO.CreateSalesInvoiceRequest) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error) {
	// Tạo mã phiếu tự động
	invoiceCode := s.generateInvoiceCode()
	
	// Tính tổng tiền từ các items
	var totalAmount float64 = 0
	var totalItems int32 = 0
	var processedItems []salesVO.SalesInvoiceItemResponse
	
	for _, item := range req.Items {
		// Tính toán giá cho item
		totalPrice, discountAmount, finalPrice, err := s.calculateItemPrice(
			item.Quantity, 
			item.UnitPrice, 
			item.DiscountPercent, 
			item.DiscountAmount,
		)
		if err != nil {
			return nil, &response.ResponseData{
				Code:    response.ErrCodeParamInvalid,
				Message: err.Error(),
				Data:    nil,
			}, err
		}
		
		// Parse final price để cộng vào tổng
		finalPriceFloat, _ := strconv.ParseFloat(finalPrice, 64)
		totalAmount += finalPriceFloat
		totalItems += item.Quantity
		
		// TODO: Thêm vào database khi có sqlc
		processedItem := salesVO.SalesInvoiceItemResponse{
			ID:              int32(len(processedItems) + 1), // Mock ID
			InvoiceID:       1, // Mock invoice ID
			ProductID:       item.ProductID,
			ProductName:     fmt.Sprintf("Product %d", item.ProductID), // Mock name
			Quantity:        item.Quantity,
			UnitPrice:       item.UnitPrice,
			TotalPrice:      totalPrice,
			DiscountPercent: "0",
			DiscountAmount:  discountAmount,
			FinalPrice:      finalPrice,
			Notes:           item.Notes,
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}
		
		if item.DiscountPercent != nil {
			processedItem.DiscountPercent = *item.DiscountPercent
		}
		
		processedItems = append(processedItems, processedItem)
	}
	
	// Tính giảm giá tổng
	var discountAmountFloat float64 = 0
	if req.DiscountAmount != nil && *req.DiscountAmount != "" {
		discount, err := strconv.ParseFloat(*req.DiscountAmount, 64)
		if err == nil && discount >= 0 {
			discountAmountFloat = discount
		}
	}
	
	// Đảm bảo giảm giá không vượt quá tổng tiền
	if discountAmountFloat > totalAmount {
		discountAmountFloat = totalAmount
	}
	
	finalAmount := totalAmount - discountAmountFloat
	
	// TODO: Lưu vào database khi có sqlc
	result := &salesVO.SalesInvoiceResponse{
		ID:                1, // Mock ID
		InvoiceCode:       invoiceCode,
		CustomerName:      req.CustomerName,
		CustomerPhone:     req.CustomerPhone,
		CustomerEmail:     req.CustomerEmail,
		CustomerAddress:   req.CustomerAddress,
		CreatedByUserID:   userID,
		TotalAmount:       fmt.Sprintf("%.2f", totalAmount),
		TotalItems:        totalItems,
		DiscountAmount:    fmt.Sprintf("%.2f", discountAmountFloat),
		FinalAmount:       fmt.Sprintf("%.2f", finalAmount),
		PaymentMethod:     req.PaymentMethod,
		PaymentStatus:     1, // Chưa thanh toán
		PaymentStatusText: salesVO.GetPaymentStatusText(1),
		Notes:             req.Notes,
		Status:            1, // Nháp
		StatusText:        salesVO.GetStatusText(1),
		InvoiceDate:       time.Now(),
		DeliveryDate:      req.DeliveryDate,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
		Items:             processedItems,
	}
	
	return result, nil, nil
}

// GetSalesInvoice lấy thông tin phiếu bán hàng theo ID
func (s *salesService) GetSalesInvoice(ctx context.Context, id int32) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	// Mock data
	items := []salesVO.SalesInvoiceItemResponse{
		{
			ID:              1,
			InvoiceID:       id,
			ProductID:       1,
			ProductName:     "Nấm shiitake",
			Quantity:        10,
			UnitPrice:       "50000.00",
			TotalPrice:      "500000.00",
			DiscountPercent: "10.00",
			DiscountAmount:  "50000.00",
			FinalPrice:      "450000.00",
			Notes:           stringPtr("Sản phẩm tươi"),
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		},
	}
	
	result := &salesVO.SalesInvoiceResponse{
		ID:                id,
		InvoiceCode:       "SI-001",
		CustomerName:      stringPtr("Nguyễn Văn A"),
		CustomerPhone:     stringPtr("0123456789"),
		CustomerEmail:     stringPtr("nguyenvana@email.com"),
		CustomerAddress:   stringPtr("123 Đường ABC, Quận 1, TP.HCM"),
		CreatedByUserID:   1,
		TotalAmount:       "500000.00",
		TotalItems:        10,
		DiscountAmount:    "50000.00",
		FinalAmount:       "450000.00",
		PaymentMethod:     "CASH",
		PaymentStatus:     1,
		PaymentStatusText: salesVO.GetPaymentStatusText(1),
		Notes:             stringPtr("Giao hàng buổi sáng"),
		Status:            1,
		StatusText:        salesVO.GetStatusText(1),
		InvoiceDate:       time.Now(),
		DeliveryDate:      timePtr(time.Now().Add(24 * time.Hour)),
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
		Items:             items,
	}
	
	return result, nil, nil
}

// GetSalesInvoiceByCode lấy thông tin phiếu bán hàng theo mã
func (s *salesService) GetSalesInvoiceByCode(ctx context.Context, code string) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	return s.GetSalesInvoice(ctx, 1) // Mock: return first invoice
}

// ListSalesInvoices lấy danh sách phiếu bán hàng
func (s *salesService) ListSalesInvoices(ctx context.Context, req *salesVO.ListSalesInvoicesRequest) (*salesVO.ListSalesInvoicesResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	// Mock data
	invoices := []salesVO.SalesInvoiceResponse{
		{
			ID:                1,
			InvoiceCode:       "SI-001",
			CustomerName:      stringPtr("Nguyễn Văn A"),
			CustomerPhone:     stringPtr("0123456789"),
			CustomerEmail:     stringPtr("nguyenvana@email.com"),
			CreatedByUserID:   1,
			TotalAmount:       "500000.00",
			TotalItems:        10,
			DiscountAmount:    "50000.00",
			FinalAmount:       "450000.00",
			PaymentMethod:     "CASH",
			PaymentStatus:     1,
			PaymentStatusText: salesVO.GetPaymentStatusText(1),
			Status:            1,
			StatusText:        salesVO.GetStatusText(1),
			InvoiceDate:       time.Now(),
			CreatedAt:         time.Now(),
			UpdatedAt:         time.Now(),
		},
		{
			ID:                2,
			InvoiceCode:       "SI-002",
			CustomerName:      stringPtr("Trần Thị B"),
			CustomerPhone:     stringPtr("0987654321"),
			CustomerEmail:     stringPtr("tranthib@email.com"),
			CreatedByUserID:   1,
			TotalAmount:       "300000.00",
			TotalItems:        5,
			DiscountAmount:    "0.00",
			FinalAmount:       "300000.00",
			PaymentMethod:     "BANK_TRANSFER",
			PaymentStatus:     3,
			PaymentStatusText: salesVO.GetPaymentStatusText(3),
			Status:            4,
			StatusText:        salesVO.GetStatusText(4),
			InvoiceDate:       time.Now().Add(-24 * time.Hour),
			CreatedAt:         time.Now().Add(-24 * time.Hour),
			UpdatedAt:         time.Now(),
		},
	}
	
	totalPages := int32(math.Ceil(float64(len(invoices)) / float64(req.Limit)))
	
	result := &salesVO.ListSalesInvoicesResponse{
		Items: invoices,
		Pagination: model.PaginationMeta{
			Total:      int64(len(invoices)),
			Page:       int(req.Page),
			PageSize:   int(req.Limit),
			TotalPages: int(totalPages),
			HasNext:    req.Page < totalPages,
			HasPrev:    req.Page > 1,
		},
	}
	
	return result, nil, nil
}

// UpdateSalesInvoice cập nhật phiếu bán hàng
func (s *salesService) UpdateSalesInvoice(ctx context.Context, id int32, req *salesVO.UpdateSalesInvoiceRequest) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	// Kiểm tra trạng thái phiếu trước khi cho phép cập nhật
	
	result := &salesVO.SalesInvoiceResponse{
		ID:                id,
		InvoiceCode:       "SI-001",
		CustomerName:      req.CustomerName,
		CustomerPhone:     req.CustomerPhone,
		CustomerEmail:     req.CustomerEmail,
		CustomerAddress:   req.CustomerAddress,
		CreatedByUserID:   1,
		TotalAmount:       "500000.00",
		TotalItems:        10,
		DiscountAmount:    "50000.00",
		FinalAmount:       "450000.00",
		PaymentMethod:     getStringValue(req.PaymentMethod, "CASH"),
		PaymentStatus:     getInt32Value(req.PaymentStatus, 1),
		PaymentStatusText: salesVO.GetPaymentStatusText(getInt32Value(req.PaymentStatus, 1)),
		Notes:             req.Notes,
		Status:            getInt32Value(req.Status, 1),
		StatusText:        salesVO.GetStatusText(getInt32Value(req.Status, 1)),
		InvoiceDate:       time.Now(),
		DeliveryDate:      req.DeliveryDate,
		CompletedDate:     req.CompletedDate,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	
	return result, nil, nil
}

// DeleteSalesInvoice xóa phiếu bán hàng
func (s *salesService) DeleteSalesInvoice(ctx context.Context, id int32) (*response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	// Kiểm tra trạng thái phiếu trước khi cho phép xóa (chỉ xóa khi ở trạng thái nháp)
	return nil, nil
}

// ===== CÁC HÀNH ĐỘNG VỚI PHIẾU =====

// ConfirmSalesInvoice xác nhận phiếu bán hàng
func (s *salesService) ConfirmSalesInvoice(ctx context.Context, id int32, req *salesVO.ConfirmSalesInvoiceRequest) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	// 1. Kiểm tra phiếu có tồn tại không
	// 2. Kiểm tra trạng thái phiếu (phải là nháp)
	// 3. Kiểm tra tồn kho của các sản phẩm
	// 4. Cập nhật trạng thái sang đã xác nhận
	
	result := &salesVO.SalesInvoiceResponse{
		ID:                id,
		InvoiceCode:       "SI-001",
		CustomerName:      stringPtr("Nguyễn Văn A"),
		CustomerPhone:     stringPtr("0123456789"),
		CreatedByUserID:   1,
		TotalAmount:       "500000.00",
		TotalItems:        10,
		DiscountAmount:    "50000.00",
		FinalAmount:       "450000.00",
		PaymentMethod:     "CASH",
		PaymentStatus:     1,
		PaymentStatusText: salesVO.GetPaymentStatusText(1),
		Status:            2, // Đã xác nhận
		StatusText:        salesVO.GetStatusText(2),
		InvoiceDate:       time.Now(),
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	
	return result, nil, nil
}

// DeliverSalesInvoice đánh dấu đã giao hàng và cập nhật inventory
func (s *salesService) DeliverSalesInvoice(ctx context.Context, id int32, req *salesVO.DeliverSalesInvoiceRequest) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	// 1. Kiểm tra phiếu có tồn tại không
	// 2. Kiểm tra trạng thái phiếu (phải là đã xác nhận)
	// 3. Cập nhật inventory (trừ số lượng tồn kho)
	// 4. Tạo inventory history với type "OUT"
	// 5. Cập nhật trạng thái sang đã giao hàng
	
	// MOCK: Lấy thông tin phiếu bán hàng (thực tế sẽ từ database)
	mockInvoice := &salesVO.SalesInvoiceResponse{
		ID:           id,
		InvoiceCode:  "SI-001",
		Status:       2, // Đã xác nhận
		TotalItems:   10,
	}
	
	// Kiểm tra trạng thái phiếu
	if mockInvoice.Status != 2 {
		return nil, &response.ResponseData{
			Code:    response.ErrCodeParamInvalid,
			Message: "Chỉ có thể giao hàng cho phiếu đã xác nhận",
			Data:    nil,
		}, fmt.Errorf("invalid invoice status: %d", mockInvoice.Status)
	}
	
	// MOCK: Lấy danh sách sản phẩm trong phiếu (thực tế sẽ từ database)
	mockItems := []salesVO.SalesInvoiceItemResponse{
		{
			ProductID: 1,
			Quantity:  10,
			UnitPrice: "50000.00",
		},
		// Có thể có nhiều sản phẩm khác
	}
	
	// Cập nhật inventory cho từng sản phẩm
	for _, item := range mockItems {
		// Tạo stock out request
		stockOutReq := &inventoryVO.StockOutRequest{
			ProductID:       item.ProductID,
			Quantity:        item.Quantity,
			ReferenceType:   stringPtr("SALES_INVOICE"),
			ReferenceID:     &id,
			Notes:           stringPtr(fmt.Sprintf("Xuất kho cho phiếu bán hàng %s", mockInvoice.InvoiceCode)),
			CreatedByUserID: req.DeliveredByUserID,
		}
		
		// Gọi inventory transaction service để xuất kho
		// TODO: Khi có inventory transaction service, uncomment dòng sau
		// _, responseData, err := service.InventoryTransaction.ProcessStockOut(ctx, stockOutReq)
		// if err != nil {
		//     return nil, responseData, fmt.Errorf("failed to process stock out for product %d: %w", item.ProductID, err)
		// }
		
		// MOCK: Log việc xuất kho (thực tế sẽ cập nhật database)
		fmt.Printf("MOCK: Xuất kho sản phẩm ID %d, số lượng %d cho phiếu %s\n", 
			stockOutReq.ProductID, stockOutReq.Quantity, mockInvoice.InvoiceCode)
	}
	
	// Cập nhật trạng thái phiếu sang đã giao hàng
	result := &salesVO.SalesInvoiceResponse{
		ID:                id,
		InvoiceCode:       "SI-001",
		CustomerName:      stringPtr("Nguyễn Văn A"),
		CustomerPhone:     stringPtr("0123456789"),
		CreatedByUserID:   1,
		TotalAmount:       "500000.00",
		TotalItems:        10,
		DiscountAmount:    "50000.00",
		FinalAmount:       "450000.00",
		PaymentMethod:     "CASH",
		PaymentStatus:     1,
		PaymentStatusText: salesVO.GetPaymentStatusText(1),
		Status:            3, // Đã giao hàng
		StatusText:        salesVO.GetStatusText(3),
		InvoiceDate:       time.Now(),
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	
	return result, nil, nil
}

// CompleteSalesInvoice hoàn thành phiếu bán hàng
func (s *salesService) CompleteSalesInvoice(ctx context.Context, id int32, req *salesVO.CompleteSalesInvoiceRequest) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	result := &salesVO.SalesInvoiceResponse{
		ID:                id,
		InvoiceCode:       "SI-001",
		CustomerName:      stringPtr("Nguyễn Văn A"),
		CustomerPhone:     stringPtr("0123456789"),
		CreatedByUserID:   1,
		TotalAmount:       "500000.00",
		TotalItems:        10,
		DiscountAmount:    "50000.00",
		FinalAmount:       "450000.00",
		PaymentMethod:     "CASH",
		PaymentStatus:     req.PaymentStatus,
		PaymentStatusText: salesVO.GetPaymentStatusText(req.PaymentStatus),
		Status:            4, // Hoàn thành
		StatusText:        salesVO.GetStatusText(4),
		InvoiceDate:       time.Now(),
		CompletedDate:     &req.CompletedDate,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	
	return result, nil, nil
}

// CancelSalesInvoice hủy phiếu bán hàng
func (s *salesService) CancelSalesInvoice(ctx context.Context, id int32, req *salesVO.CancelSalesInvoiceRequest) (*salesVO.SalesInvoiceResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	// 1. Kiểm tra phiếu có tồn tại không
	// 2. Kiểm tra trạng thái phiếu
	// 3. Nếu đã giao hàng, hoàn trả inventory
	// 4. Cập nhật trạng thái sang đã hủy
	
	// MOCK: Lấy thông tin phiếu bán hàng (thực tế sẽ từ database)
	mockInvoice := &salesVO.SalesInvoiceResponse{
		ID:           id,
		InvoiceCode:  "SI-001",
		Status:       3, // Đã giao hàng
		TotalItems:   10,
	}
	
	// Nếu phiếu đã giao hàng, cần hoàn trả inventory
	if mockInvoice.Status == 3 || mockInvoice.Status == 4 {
		// MOCK: Lấy danh sách sản phẩm trong phiếu
		mockItems := []salesVO.SalesInvoiceItemResponse{
			{
				ProductID: 1,
				Quantity:  10,
				UnitPrice: "50000.00",
			},
		}
		
		// Hoàn trả inventory cho từng sản phẩm
		for _, item := range mockItems {
			// Tạo stock in request để hoàn trả
			stockInReq := &inventoryVO.StockInRequest{
				ProductID:       item.ProductID,
				Quantity:        item.Quantity,
				UnitCostPrice:   item.UnitPrice, // Dùng giá bán làm giá vốn tạm thời
				ReferenceType:   stringPtr("SALES_CANCEL"),
				ReferenceID:     &id,
				Notes:           stringPtr(fmt.Sprintf("Hoàn trả hàng do hủy phiếu %s: %s", mockInvoice.InvoiceCode, req.Reason)),
				CreatedByUserID: req.CancelledByUserID,
			}
			
			// Gọi inventory transaction service để nhập lại hàng
			// TODO: Khi có inventory transaction service, uncomment dòng sau
			// _, responseData, err := service.InventoryTransaction.ProcessStockIn(ctx, stockInReq)
			// if err != nil {
			//     return nil, responseData, fmt.Errorf("failed to return stock for product %d: %w", item.ProductID, err)
			// }
			
			// MOCK: Log việc hoàn trả hàng
			fmt.Printf("MOCK: Hoàn trả hàng sản phẩm ID %d, số lượng %d cho phiếu hủy %s\n", 
				stockInReq.ProductID, stockInReq.Quantity, mockInvoice.InvoiceCode)
		}
	}
	
	result := &salesVO.SalesInvoiceResponse{
		ID:                id,
		InvoiceCode:       "SI-001",
		CustomerName:      stringPtr("Nguyễn Văn A"),
		CustomerPhone:     stringPtr("0123456789"),
		CreatedByUserID:   1,
		TotalAmount:       "500000.00",
		TotalItems:        10,
		DiscountAmount:    "50000.00",
		FinalAmount:       "450000.00",
		PaymentMethod:     "CASH",
		PaymentStatus:     1,
		PaymentStatusText: salesVO.GetPaymentStatusText(1),
		Status:            5, // Đã hủy
		StatusText:        salesVO.GetStatusText(5),
		Notes:             &req.Reason,
		InvoiceDate:       time.Now(),
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	
	return result, nil, nil
}

// ===== QUẢN LÝ CHI TIẾT SẢN PHẨM =====

// GetSalesInvoiceItems lấy danh sách sản phẩm trong phiếu
func (s *salesService) GetSalesInvoiceItems(ctx context.Context, invoiceID int32) ([]salesVO.SalesInvoiceItemResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	items := []salesVO.SalesInvoiceItemResponse{
		{
			ID:              1,
			InvoiceID:       invoiceID,
			ProductID:       1,
			ProductName:     "Nấm shiitake",
			Quantity:        10,
			UnitPrice:       "50000.00",
			TotalPrice:      "500000.00",
			DiscountPercent: "10.00",
			DiscountAmount:  "50000.00",
			FinalPrice:      "450000.00",
			Notes:           stringPtr("Sản phẩm tươi"),
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		},
	}
	
	return items, nil, nil
}

// UpdateSalesInvoiceItem cập nhật thông tin một sản phẩm trong phiếu
func (s *salesService) UpdateSalesInvoiceItem(ctx context.Context, id int32, req *salesVO.UpdateSalesInvoiceItemRequest) (*salesVO.SalesInvoiceItemResponse, *response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	result := &salesVO.SalesInvoiceItemResponse{
		ID:              id,
		InvoiceID:       1,
		ProductID:       1,
		ProductName:     "Nấm shiitake",
		Quantity:        getInt32Value(req.Quantity, 10),
		UnitPrice:       getStringValue(req.UnitPrice, "50000.00"),
		TotalPrice:      "500000.00",
		DiscountPercent: getStringValue(req.DiscountPercent, "10.00"),
		DiscountAmount:  getStringValue(req.DiscountAmount, "50000.00"),
		FinalPrice:      "450000.00",
		Notes:           req.Notes,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	
	return result, nil, nil
}

// DeleteSalesInvoiceItem xóa một sản phẩm khỏi phiếu
func (s *salesService) DeleteSalesInvoiceItem(ctx context.Context, id int32) (*response.ResponseData, error) {
	// TODO: Implement after sqlc generation
	// Kiểm tra trạng thái phiếu trước khi cho phép xóa
	return nil, nil
}

// ===== UTILITY FUNCTIONS =====

// getStringValue trả về giá trị string hoặc default nếu nil
func getStringValue(ptr *string, defaultValue string) string {
	if ptr != nil {
		return *ptr
	}
	return defaultValue
}

// getInt32Value trả về giá trị int32 hoặc default nếu nil
func getInt32Value(ptr *int32, defaultValue int32) int32 {
	if ptr != nil {
		return *ptr
	}
	return defaultValue
}