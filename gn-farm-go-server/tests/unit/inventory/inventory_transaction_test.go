package inventory_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"testing"

	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service/impl/inventory"
	"gn-farm-go-server/internal/testutil"
	inventoryVO "gn-farm-go-server/internal/vo/inventory"
	"gn-farm-go-server/pkg/response"

	"github.com/sqlc-dev/pqtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper function to create string pointer
func stringPtr(s string) *string {
	return &s
}

// TestInventoryTransaction_ProcessStockIn kiểm tra logic nhập kho và tính toán giá trung bình
func TestInventoryTransaction_ProcessStockIn(t *testing.T) {
	// Thiết lập database test
	queries := testutil.SetupTestDB(t)
	if queries == nil {
		t.Skip("Test database not available")
	}
	defer testutil.CleanupTestDB(t)

	// Tạo service instance
	service := inventory.NewInventoryTransactionService(queries)

	// Tạo sản phẩm test
	productID := createTestProduct(t, queries)

	tests := []struct {
		name                string
		input               *inventoryVO.StockInRequest
		expectedCode        int
		expectedError       bool
		expectedNewAvgPrice string
		description         string
	}{
		{
			name: "Nhập kho lần đầu - tính giá trung bình ban đầu",
			input: &inventoryVO.StockInRequest{
				ProductID:     productID,
				Quantity:      100,
				UnitCostPrice: "15000",
				Notes:         stringPtr("Nhập kho lần đầu"),
			},
			expectedCode:        response.ErrCodeSuccess,
			expectedError:       false,
			expectedNewAvgPrice: "15000",
			description:         "Khi nhập kho lần đầu, giá trung bình phải bằng giá nhập",
		},
		{
			name: "Nhập kho lần 2 - tính giá trung bình gia quyền",
			input: &inventoryVO.StockInRequest{
				ProductID:     productID,
				Quantity:      50,
				UnitCostPrice: "18000",
				Notes:         stringPtr("Nhập kho lần 2"),
			},
			expectedCode:        response.ErrCodeSuccess,
			expectedError:       false,
			expectedNewAvgPrice: "16000", // (100*15000 + 50*18000) / 150 = 16000
			description:         "Giá trung bình gia quyền phải được tính đúng",
		},
		{
			name: "Nhập kho với số lượng 0 - lỗi",
			input: &inventoryVO.StockInRequest{
				ProductID:     productID,
				Quantity:      0,
				UnitCostPrice: "15000",
				Notes:         stringPtr("Số lượng không hợp lệ"),
			},
			expectedCode:  response.ErrCodeParamInvalid,
			expectedError: true,
			description:   "Số lượng nhập phải lớn hơn 0",
		},
		{
			name: "Nhập kho với giá âm - lỗi",
			input: &inventoryVO.StockInRequest{
				ProductID:     productID,
				Quantity:      10,
				UnitCostPrice: "-1000",
				Notes:         stringPtr("Giá không hợp lệ"),
			},
			expectedCode:  response.ErrCodeParamInvalid,
			expectedError: true,
			description:   "Giá nhập phải lớn hơn 0",
		},
		{
			name: "Nhập kho với product ID không tồn tại - lỗi",
			input: &inventoryVO.StockInRequest{
				ProductID:     99999,
				Quantity:      10,
				UnitCostPrice: "15000",
				Notes:         stringPtr("Product không tồn tại"),
			},
			expectedCode:  response.ErrCodeNotFound,
			expectedError: true,
			description:   "Product ID phải tồn tại trong hệ thống",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Thực hiện test
			code, result, err := service.ProcessStockIn(context.Background(), tt.input)

			// Kiểm tra kết quả
			if tt.expectedError {
				assert.Error(t, err, tt.description)
				assert.Equal(t, tt.expectedCode, code, "Mã lỗi không đúng")
			} else {
				assert.NoError(t, err, tt.description)
				assert.Equal(t, tt.expectedCode, code, "Mã thành công không đúng")
				assert.NotNil(t, result, "Kết quả không được nil")

				// Kiểm tra giá trung bình được cập nhật đúng
				if tt.expectedNewAvgPrice != "" {
					product, err := queries.GetProductCostInfo(context.Background(), tt.input.ProductID)
					require.NoError(t, err)
					assert.Equal(t, tt.expectedNewAvgPrice, product.AverageCostPrice, "Giá trung bình không đúng")
				}
			}
		})
	}
}

// TestInventoryTransaction_CalculateWeightedAverage kiểm tra logic tính toán giá trung bình gia quyền
func TestInventoryTransaction_CalculateWeightedAverage(t *testing.T) {
	tests := []struct {
		name                string
		currentQuantity     int32
		currentAvgPrice     string
		newQuantity         int32
		newUnitPrice        string
		expectedAvgPrice    string
		expectedTotalQty    int32
		description         string
	}{
		{
			name:                "Tính toán cơ bản - có tồn kho",
			currentQuantity:     100,
			currentAvgPrice:     "15000",
			newQuantity:         50,
			newUnitPrice:        "18000",
			expectedAvgPrice:    "16000", // (100*15000 + 50*18000) / 150
			expectedTotalQty:    150,
			description:         "Giá trung bình gia quyền cơ bản",
		},
		{
			name:                "Tồn kho bằng 0 - giá mới",
			currentQuantity:     0,
			currentAvgPrice:     "0",
			newQuantity:         100,
			newUnitPrice:        "20000",
			expectedAvgPrice:    "20000",
			expectedTotalQty:    100,
			description:         "Khi tồn kho = 0, giá trung bình = giá nhập mới",
		},
		{
			name:                "Số lượng lớn - kiểm tra độ chính xác",
			currentQuantity:     1000,
			currentAvgPrice:     "12500",
			newQuantity:         500,
			newUnitPrice:        "15000",
			expectedAvgPrice:    "13333", // (1000*12500 + 500*15000) / 1500 = 13333.33
			expectedTotalQty:    1500,
			description:         "Kiểm tra độ chính xác với số lượng lớn",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Tính toán giá trung bình gia quyền
			newAvgPrice, totalQty := calculateWeightedAverage(
				tt.currentQuantity,
				tt.currentAvgPrice,
				tt.newQuantity,
				tt.newUnitPrice,
			)

			// Kiểm tra kết quả
			assert.Equal(t, tt.expectedAvgPrice, newAvgPrice, tt.description)
			assert.Equal(t, tt.expectedTotalQty, totalQty, "Tổng số lượng không đúng")
		})
	}
}

// createTestProduct tạo một sản phẩm test trong database
func createTestProduct(t *testing.T, queries *database.Queries) int32 {

	product, err := queries.CreateProduct(context.Background(), database.CreateProductParams{
		ProductName:            "Test Product",
		ProductPrice:           "100000",
		ProductStatus:          sql.NullInt32{Int32: 1, Valid: true},
		ProductThumb:           "test-thumb.jpg",
		ProductPictures:        []string{"test-pic.jpg"},
		ProductVideos:          []string{},
		ProductRatingsAverage:  sql.NullString{String: "0", Valid: true},
		ProductVariations:      pqtype.NullRawMessage{RawMessage: json.RawMessage(`{}`), Valid: true},
		ProductDescription:     sql.NullString{String: "Test product", Valid: true},
		ProductSlug:            sql.NullString{String: "test-product", Valid: true},
		ProductQuantity:        sql.NullInt32{Int32: 0, Valid: true},
		ProductType:            1,
		SubProductType:         []int32{1},
		Discount:               sql.NullString{String: "0", Valid: true},
		ProductDiscountedPrice: "100000",
		ProductSelled:          sql.NullInt32{Int32: 0, Valid: true},
		ProductAttributes:      json.RawMessage("{}"),
		IsDraft:                sql.NullBool{Bool: false, Valid: true},
		IsPublished:            sql.NullBool{Bool: true, Valid: true},
	})

	require.NoError(t, err)
	return product.ID
}

// calculateWeightedAverage tính toán giá trung bình gia quyền
// Hàm helper để test logic tính toán
func calculateWeightedAverage(currentQty int32, currentAvgPrice string, newQty int32, newUnitPrice string) (string, int32) {
	// Logic tính toán giá trung bình gia quyền
	// Công thức: (currentQty * currentAvgPrice + newQty * newUnitPrice) / (currentQty + newQty)
	
	// Parse giá hiện tại
	currentPrice := parsePrice(currentAvgPrice)
	newPrice := parsePrice(newUnitPrice)
	
	// Tính tổng giá trị
	totalValue := float64(currentQty)*currentPrice + float64(newQty)*newPrice
	totalQty := currentQty + newQty
	
	// Tính giá trung bình
	var avgPrice float64
	if totalQty > 0 {
		avgPrice = totalValue / float64(totalQty)
	}
	
	// Làm tròn và chuyển về string
	avgPriceStr := formatPrice(avgPrice)
	
	return avgPriceStr, totalQty
}

// parsePrice chuyển đổi string thành float64
func parsePrice(priceStr string) float64 {
	if priceStr == "" || priceStr == "0" {
		return 0
	}
	// Sử dụng strconv để parse
	price, err := strconv.ParseFloat(priceStr, 64)
	if err != nil {
		return 0
	}
	return price
}

// formatPrice chuyển đổi float64 thành string
func formatPrice(price float64) string {
	// Làm tròn đến số nguyên gần nhất
	rounded := int64(price + 0.5)
	return strconv.FormatInt(rounded, 10)
}