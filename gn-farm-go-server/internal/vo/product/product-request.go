package product

import "encoding/json"

// CreateProductRequest represents a request to create a product with all fields
type CreateProductRequest struct {
	ProductName            string          `json:"productName" example:"Organic Tomato"`
	ProductPrice           string          `json:"productPrice" example:"15.99"`
	ProductStatus          *int32          `json:"productStatus,omitempty" example:"1"`
	ProductThumb           string          `json:"productThumb" example:"https://example.com/tomato.jpg"`
	ProductPictures        []string        `json:"productPictures"`
	ProductVideos          []string        `json:"productVideos"`
	ProductDescription     *string         `json:"productDescription,omitempty" example:"Fresh organic tomatoes"`
	ProductQuantity        *int32          `json:"productQuantity,omitempty" example:"100"`
	ProductType            int32           `json:"productType" example:"1"`
	SubProductType         []int32         `json:"subProductType" example:"[1,2]"`
	Discount               *string         `json:"discount,omitempty" example:"10"`
	ProductDiscountedPrice string          `json:"productDiscountedPrice" example:"14.39"`
	ProductAttributes      json.RawMessage `json:"productAttributes"`
	IsDraft                bool            `json:"isDraft" example:"false"`
	IsPublished            bool            `json:"isPublished" example:"true"`
}

// UpdateProductRequest represents a request to update a product with all fields
type UpdateProductRequest struct {
	ID                    *int32          `json:"id,omitempty" example:"1"` // Thêm trường ID cho BulkUpdateProducts
	ProductName            *string         `json:"productName,omitempty" example:"Organic Tomato Premium"`
	ProductPrice           *string         `json:"productPrice,omitempty" example:"19.99"`
	ProductStatus          *int32          `json:"productStatus,omitempty" example:"1"`
	ProductThumb           *string         `json:"productThumb,omitempty" example:"https://example.com/tomato-premium.jpg"`
	ProductPictures        *[]string       `json:"productPictures,omitempty"`
	ProductVideos          *[]string       `json:"productVideos,omitempty"`
	ProductDescription     *string         `json:"productDescription,omitempty" example:"Premium organic tomatoes"`
	ProductQuantity        *int32          `json:"productQuantity,omitempty" example:"50"`
	ProductType            *int32          `json:"productType,omitempty" example:"1"`
	SubProductType         *[]int32        `json:"subProductType,omitempty" example:"[1,2]"`
	Discount               *string         `json:"discount,omitempty" example:"15"`
	ProductDiscountedPrice *string         `json:"productDiscountedPrice,omitempty" example:"16.99"`
	ProductAttributes      json.RawMessage `json:"productAttributes,omitempty"`
	IsDraft                *bool           `json:"isDraft,omitempty" example:"false"`
	IsPublished            *bool           `json:"isPublished,omitempty" example:"true"`
}

// BulkUpdateRequest represents a request to update multiple products
type BulkUpdateRequest struct {
	Products []ProductUpdateItem `json:"products"`
}

// ProductUpdateItem represents a single product update in a bulk update
type ProductUpdateItem struct {
	ID           int    `json:"id" example:"1"`
	ProductName  string `json:"productName" example:"Updated Product 1"`
	ProductPrice string `json:"productPrice" example:"29.99"`
}

// ProductSubTypeRequest định nghĩa cấu trúc cho request tạo/sửa subtype sản phẩm
type ProductSubTypeRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	ProductType int32  `json:"productType" binding:"required"`
}

// FilterProductsRequest represents a request to filter products
type FilterProductsRequest struct {
	Category  *string  `json:"category,omitempty" form:"category"`
	MinPrice  *float64 `json:"minPrice,omitempty" form:"minPrice"`
	MaxPrice  *float64 `json:"maxPrice,omitempty" form:"maxPrice"`
	InStock   *bool    `json:"inStock,omitempty" form:"inStock"`
	Tags      []string `json:"tags,omitempty" form:"tags"`
	SortBy    string   `json:"sortBy,omitempty" form:"sortBy" binding:"omitempty,oneof=price name created_at"`
	SortOrder string   `json:"sortOrder,omitempty" form:"sortOrder" binding:"omitempty,oneof=asc desc"`
	Limit     int32    `json:"limit" form:"limit" binding:"required,min=1,max=100"`
	Offset    int32    `json:"offset" form:"offset" binding:"min=0"`
}
