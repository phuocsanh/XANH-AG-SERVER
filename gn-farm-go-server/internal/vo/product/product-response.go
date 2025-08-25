package product

import (
	"encoding/json"
	"time"

	"github.com/guregu/null"
)

// ProductResponse định nghĩa cấu trúc response cho product (sử dụng guregu/null)
type ProductResponse struct {
	ID                     int32           `json:"id"`
	ProductName            string          `json:"productName"`
	ProductPrice           string          `json:"productPrice"`
	ProductStatus          null.Int        `json:"productStatus"`
	ProductThumb           string          `json:"productThumb"`
	ProductPictures        []string        `json:"productPictures"`
	ProductVideos          []string        `json:"productVideos"`
	ProductRatingsAverage  null.String     `json:"productRatingsAverage"`
	ProductVariations      json.RawMessage `json:"productVariations"`
	ProductDescription     null.String     `json:"productDescription"`
	ProductSlug            null.String     `json:"productSlug"`
	ProductQuantity        null.Int        `json:"productQuantity"`
	ProductType            int32           `json:"productType"`
	SubProductType         []int32         `json:"subProductType"`
	Discount               null.String     `json:"discount"`
	ProductDiscountedPrice string          `json:"productDiscountedPrice"`
	ProductSelled          null.Int        `json:"productSelled"`
	ProductAttributes      json.RawMessage `json:"productAttributes"`
	IsDraft                null.Bool       `json:"isDraft"`
	IsPublished            null.Bool       `json:"isPublished"`
	CreatedAt              time.Time       `json:"createdAt"`
	UpdatedAt              time.Time       `json:"updatedAt"`
}



// ProductTypeResponse định nghĩa cấu trúc cho response loại sản phẩm
type ProductTypeResponse struct {
	ID          int32       `json:"id"`
	Name        string      `json:"name"`
	Description null.String `json:"description"`
	ImageURL    null.String `json:"imageUrl"`
	CreatedAt   time.Time   `json:"createdAt"`
	UpdatedAt   time.Time   `json:"updatedAt"`
}

// ProductSubTypeResponse định nghĩa cấu trúc cho response subtype sản phẩm
type ProductSubTypeResponse struct {
	ID          int32       `json:"id"`
	Name        string      `json:"name"`
	Description null.String `json:"description"`
	ProductType int32       `json:"productType"`
	CreatedAt   time.Time   `json:"createdAt"`
	UpdatedAt   time.Time   `json:"updatedAt"`
}

// ProductStats định nghĩa cấu trúc cho thống kê sản phẩm
type ProductStats struct {
	TotalProducts     int64   `json:"totalProducts"`
	InStockProducts   int64   `json:"inStockProducts"`
	OutOfStockProducts int64  `json:"outOfStockProducts"`
	TotalProductsSold int64   `json:"totalProductsSold"`
	AverageRating     float64 `json:"averageRating"`
	MinPrice          string  `json:"minPrice"`
	MaxPrice          string  `json:"maxPrice"`
	AvgPrice          string  `json:"avgPrice"`
	TotalCategories   int64   `json:"totalCategories"`
}


