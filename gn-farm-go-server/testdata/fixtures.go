package testdata

import (
	"gn-farm-go-server/internal/vo/product"
	"gn-farm-go-server/internal/vo/user"
)

// UserFixtures provides test data for user-related tests
type UserFixtures struct{}

// ValidRegisterRequest returns a valid user registration request
func (f *UserFixtures) ValidRegisterRequest() *user.RegisterRequest {
	return &user.RegisterRequest{
		VerifyKey:     "testuser@example.com",
		VerifyType:    1,
		VerifyPurpose: "TEST_USER",
	}
}

// ValidLoginRequest returns a valid user login request
func (f *UserFixtures) ValidLoginRequest() *user.LoginRequest {
	return &user.LoginRequest{
		UserAccount:  "testuser@example.com",
		UserPassword: "password123",
	}
}

// InvalidRegisterRequests returns various invalid registration requests
func (f *UserFixtures) InvalidRegisterRequests() []*user.RegisterRequest {
	return []*user.RegisterRequest{
		{
			VerifyKey:     "",
			VerifyType:    1,
			VerifyPurpose: "TEST_USER",
		},
		{
			VerifyKey:     "invalid-email",
			VerifyType:    1,
			VerifyPurpose: "TEST_USER",
		},
		{
			VerifyKey:     "test@example.com",
			VerifyType:    0, // invalid type
			VerifyPurpose: "TEST_USER",
		},
		{
			VerifyKey:     "test@example.com",
			VerifyType:    1,
			VerifyPurpose: "", // empty purpose
		},
	}
}

// ProductFixtures provides test data for product-related tests
type ProductFixtures struct{}

// ValidCreateProductRequest returns a valid product creation request
func (f *ProductFixtures) ValidCreateProductRequest() *product.CreateProductRequest {
	return &product.CreateProductRequest{
		ProductName:        "Test Product",
		ProductPrice:       "100.00",
		ProductType:        1,
		ProductThumb:       "thumb.jpg",
		ProductDescription: "Test product description",
		ProductQuantity:    10,
		ProductDiscount:    "10.00",
	}
}

// ValidUpdateProductRequest returns a valid product update request
func (f *ProductFixtures) ValidUpdateProductRequest() *product.UpdateProductRequest {
	return &product.UpdateProductRequest{
		ProductName:        "Updated Product",
		ProductPrice:       "150.00",
		ProductType:        1,
		ProductThumb:       "updated_thumb.jpg",
		ProductDescription: "Updated product description",
		ProductQuantity:    15,
		ProductDiscount:    "15.00",
	}
}

// InvalidCreateProductRequests returns various invalid product creation requests
func (f *ProductFixtures) InvalidCreateProductRequests() []*product.CreateProductRequest {
	return []*product.CreateProductRequest{
		{
			ProductName:  "",
			ProductPrice: "100.00",
			ProductType:  1,
		},
		{
			ProductName:  "Test Product",
			ProductPrice: "",
			ProductType:  1,
		},
		{
			ProductName:  "Test Product",
			ProductPrice: "invalid-price",
			ProductType:  1,
		},
		{
			ProductName:     "Test Product",
			ProductPrice:    "100.00",
			ProductType:     0, // invalid type
			ProductQuantity: -1, // negative quantity
		},
	}
}

// MultipleValidProducts returns multiple valid products for bulk testing
func (f *ProductFixtures) MultipleValidProducts() []*product.CreateProductRequest {
	return []*product.CreateProductRequest{
		{
			ProductName:        "Product 1",
			ProductPrice:       "100.00",
			ProductType:        1,
			ProductThumb:       "thumb1.jpg",
			ProductDescription: "Description 1",
			ProductQuantity:    10,
		},
		{
			ProductName:        "Product 2",
			ProductPrice:       "200.00",
			ProductType:        2,
			ProductThumb:       "thumb2.jpg",
			ProductDescription: "Description 2",
			ProductQuantity:    20,
		},
		{
			ProductName:        "Product 3",
			ProductPrice:       "300.00",
			ProductType:        3,
			ProductThumb:       "thumb3.jpg",
			ProductDescription: "Description 3",
			ProductQuantity:    30,
		},
	}
}

// Global fixtures instances
var (
	Users    = &UserFixtures{}
	Products = &ProductFixtures{}
)
