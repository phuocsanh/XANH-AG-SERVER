package product_test

import (
	"context"
	"encoding/json"
	"testing"

	"gn-farm-go-server/internal/service/impl/product"
	"gn-farm-go-server/internal/testutil"
	productvo "gn-farm-go-server/internal/vo/product"
	"gn-farm-go-server/pkg/response"
)

// Helper function to create string pointer
func stringPtr(s string) *string {
	return &s
}

// Helper function to create int32 pointer
func int32Ptr(i int32) *int32 {
	return &i
}

// TestProduct_CreateProduct tests product creation functionality
func TestProduct_CreateProduct(t *testing.T) {
	// Setup test database
	queries := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t)

	// Create service instance
	service := product.NewProductServiceImpl(queries)

	// Create sample product attributes
	attributes := json.RawMessage(`{"color": "red", "size": "large"}`)

	tests := []struct {
		name     string
		input    *productvo.CreateProductRequest
		wantCode int
		wantErr  bool
	}{
		{
			name: "Valid product creation",
			input: &productvo.CreateProductRequest{
				ProductName:            "Test Product",
				ProductPrice:           "100.00",
				ProductType:            1,
				ProductThumb:           "thumb.jpg",
				ProductDescription:     stringPtr("Test description"),
				ProductQuantity:        int32Ptr(10),
				ProductDiscountedPrice: "90.00",
				ProductAttributes:      attributes,
				IsDraft:                false,
				IsPublished:            true,
			},
			wantCode: response.ErrCodeSuccess,
			wantErr:  false,
		},
		{
			name: "Empty product name",
			input: &productvo.CreateProductRequest{
				ProductName:            "",
				ProductPrice:           "100.00",
				ProductType:            1,
				ProductDiscountedPrice: "90.00",
				ProductAttributes:      attributes,
			},
			wantCode: response.ErrCodeParamInvalid,
			wantErr:  true,
		},
		{
			name: "Empty product price",
			input: &productvo.CreateProductRequest{
				ProductName:            "Test Product",
				ProductPrice:           "",
				ProductType:            1,
				ProductDiscountedPrice: "90.00",
				ProductAttributes:      attributes,
			},
			wantCode: response.ErrCodeParamInvalid,
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			code, result, err := service.CreateProduct(context.Background(), tt.input)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if code != tt.wantCode {
					t.Errorf("Expected code %d, got %d", tt.wantCode, code)
				}
				// Check if result has expected structure
				if result.ID == 0 {
					t.Errorf("Expected product ID in result")
				}
				if result.ProductName != tt.input.ProductName {
					t.Errorf("Expected product name %s, got %s", tt.input.ProductName, result.ProductName)
				}
			}
		})
	}
}
