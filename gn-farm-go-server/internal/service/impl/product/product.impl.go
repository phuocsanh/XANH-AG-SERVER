package product

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"path/filepath"
	"strconv"
	"strings"

	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/model"
	productModel "gn-farm-go-server/internal/model/product"
	"gn-farm-go-server/internal/service"
	"gn-farm-go-server/internal/service/file_tracking"
	productVO "gn-farm-go-server/internal/vo/product"
	"gn-farm-go-server/pkg/response"

	"github.com/guregu/null"
)

// productService implements service.ProductService and service.ProductFactory
type productService struct {
	db *database.Queries
	// Registry for product types
	productRegistry map[int32]productCreator
}

// productCreator is a function type for creating products
type productCreator func(ctx context.Context, db *database.Queries, params interface{}) (*database.Product, error)

// Product creator functions
// createMushroomProduct creates a mushroom product
func createMushroomProduct(ctx context.Context, db *database.Queries, params interface{}) (*database.Product, error) {
	// Convert params to mushroom attributes
	mushroomAttrs, ok := params.(service.MushroomAttributes)
	if !ok {
		return nil, fmt.Errorf("invalid params type for mushroom product")
	}

	// Chuẩn bị thuộc tính cho sản phẩm
	attributes, _ := json.Marshal(mushroomAttrs)
	// Sử dụng tên thương hiệu làm tên sản phẩm nếu không có tên sản phẩm

	// Create product record
	productReq, ok := params.(service.ProductRequest)
	if !ok {
		// If not a full product request, create a minimal product
		productParams := database.CreateProductParams{
			ProductName:            "Mushroom Product",
			ProductPrice:           "0",
			ProductThumb:           "default.jpg",
			ProductPictures:        []string{},
			ProductVideos:          []string{},
			ProductType:            service.ProductTypeMushroom,
			SubProductType:         []int32{},
			ProductDiscountedPrice: "0",
			ProductAttributes:      attributes,
		}

		product, err := db.CreateProduct(ctx, productParams)
		if err != nil {
			return nil, err
		}

		return &product, nil
	}

	// Create full product with attributes
	productParams := database.CreateProductParams{
		ProductName:            productReq.ProductName,
		ProductPrice:           productReq.ProductPrice,
		ProductThumb:           productReq.ProductThumb,
		ProductPictures:        productReq.ProductPictures,
		ProductVideos:          productReq.ProductVideos,
		ProductType:            service.ProductTypeMushroom,
		SubProductType:         productReq.SubProductType,
		ProductDiscountedPrice: productReq.ProductDiscountedPrice,
		ProductAttributes:      productReq.ProductAttributes,
	}

	if productReq.ProductDescription != "" {
		productParams.ProductDescription = sql.NullString{String: productReq.ProductDescription, Valid: true}
	}

	if productReq.Discount != "" {
		productParams.Discount = sql.NullString{String: productReq.Discount, Valid: true}
	}

	if productReq.ProductQuantity > 0 {
		productParams.ProductQuantity = sql.NullInt32{Int32: productReq.ProductQuantity, Valid: true}
	}

	if productReq.ProductStatus > 0 {
		productParams.ProductStatus = sql.NullInt32{Int32: productReq.ProductStatus, Valid: true}
	}

	productParams.IsDraft = sql.NullBool{Bool: productReq.IsDraft, Valid: true}
	productParams.IsPublished = sql.NullBool{Bool: productReq.IsPublished, Valid: true}

	product, err := db.CreateProduct(ctx, productParams)
	if err != nil {
		return nil, err
	}

	return &product, nil
}

// createVegetableProduct creates a vegetable product
func createVegetableProduct(ctx context.Context, db *database.Queries, params interface{}) (*database.Product, error) {
	// Convert params to vegetable attributes
	vegetableAttrs, ok := params.(service.VegetableAttributes)
	if !ok {
		return nil, fmt.Errorf("invalid params type for vegetable product")
	}

	// Chuẩn bị thuộc tính cho sản phẩm
	attributes, _ := json.Marshal(vegetableAttrs)
	// Sử dụng tên nhà sản xuất làm tên sản phẩm nếu không có tên sản phẩm

	// Create product record
	productReq, ok := params.(service.ProductRequest)
	if !ok {
		// If not a full product request, create a minimal product
		productParams := database.CreateProductParams{
			ProductName:            "Vegetable Product",
			ProductPrice:           "0",
			ProductThumb:           "default.jpg",
			ProductPictures:        []string{},
			ProductVideos:          []string{},
			ProductType:            service.ProductTypeVegetable,
			SubProductType:         []int32{},
			ProductDiscountedPrice: "0",
			ProductAttributes:      attributes,
		}

		product, err := db.CreateProduct(ctx, productParams)
		if err != nil {
			return nil, err
		}

		return &product, nil
	}

	// Create full product with attributes
	productParams := database.CreateProductParams{
		ProductName:            productReq.ProductName,
		ProductPrice:           productReq.ProductPrice,
		ProductThumb:           productReq.ProductThumb,
		ProductPictures:        productReq.ProductPictures,
		ProductVideos:          productReq.ProductVideos,
		ProductType:            service.ProductTypeVegetable,
		SubProductType:         productReq.SubProductType,
		ProductDiscountedPrice: productReq.ProductDiscountedPrice,
		ProductAttributes:      productReq.ProductAttributes,
	}

	if productReq.ProductDescription != "" {
		productParams.ProductDescription = sql.NullString{String: productReq.ProductDescription, Valid: true}
	}

	if productReq.Discount != "" {
		productParams.Discount = sql.NullString{String: productReq.Discount, Valid: true}
	}

	if productReq.ProductQuantity > 0 {
		productParams.ProductQuantity = sql.NullInt32{Int32: productReq.ProductQuantity, Valid: true}
	}

	if productReq.ProductStatus > 0 {
		productParams.ProductStatus = sql.NullInt32{Int32: productReq.ProductStatus, Valid: true}
	}

	productParams.IsDraft = sql.NullBool{Bool: productReq.IsDraft, Valid: true}
	productParams.IsPublished = sql.NullBool{Bool: productReq.IsPublished, Valid: true}

	product, err := db.CreateProduct(ctx, productParams)
	if err != nil {
		return nil, err
	}

	return &product, nil
}

// createBonsaiProduct creates a bonsai product
func createBonsaiProduct(ctx context.Context, db *database.Queries, params interface{}) (*database.Product, error) {
	// Convert params to bonsai attributes
	bonsaiAttrs, ok := params.(service.BonsaiAttributes)
	if !ok {
		return nil, fmt.Errorf("invalid params type for bonsai product")
	}

	// Chuẩn bị thuộc tính cho sản phẩm
	attributes, _ := json.Marshal(bonsaiAttrs)
	// Sử dụng tên thương hiệu làm tên sản phẩm nếu không có tên sản phẩm

	// Create product record
	productReq, ok := params.(service.ProductRequest)
	if !ok {
		// If not a full product request, create a minimal product
		productParams := database.CreateProductParams{
			ProductName:            "Bonsai Product",
			ProductPrice:           "0",
			ProductThumb:           "default.jpg",
			ProductPictures:        []string{},
			ProductVideos:          []string{},
			ProductType:            service.ProductTypeBonsai,
			SubProductType:         []int32{},
			ProductDiscountedPrice: "0",
			ProductAttributes:      attributes,
		}

		product, err := db.CreateProduct(ctx, productParams)
		if err != nil {
			return nil, err
		}

		return &product, nil
	}

	// Create full product with attributes
	productParams := database.CreateProductParams{
		ProductName:            productReq.ProductName,
		ProductPrice:           productReq.ProductPrice,
		ProductThumb:           productReq.ProductThumb,
		ProductPictures:        productReq.ProductPictures,
		ProductVideos:          productReq.ProductVideos,
		ProductType:            service.ProductTypeBonsai,
		SubProductType:         productReq.SubProductType,
		ProductDiscountedPrice: productReq.ProductDiscountedPrice,
		ProductAttributes:      productReq.ProductAttributes,
	}

	if productReq.ProductDescription != "" {
		productParams.ProductDescription = sql.NullString{String: productReq.ProductDescription, Valid: true}
	}

	if productReq.Discount != "" {
		productParams.Discount = sql.NullString{String: productReq.Discount, Valid: true}
	}

	if productReq.ProductQuantity > 0 {
		productParams.ProductQuantity = sql.NullInt32{Int32: productReq.ProductQuantity, Valid: true}
	}

	if productReq.ProductStatus > 0 {
		productParams.ProductStatus = sql.NullInt32{Int32: productReq.ProductStatus, Valid: true}
	}

	productParams.IsDraft = sql.NullBool{Bool: productReq.IsDraft, Valid: true}
	productParams.IsPublished = sql.NullBool{Bool: productReq.IsPublished, Valid: true}

	product, err := db.CreateProduct(ctx, productParams)
	if err != nil {
		return nil, err
	}

	return &product, nil
}

// Removed NewProductService - using NewProductServiceImpl instead

// productServiceWrapper wraps productService to implement IProductService interface
type productServiceWrapper struct {
	ps *productService
	fileTrackingService file_tracking.FileTrackingService
}

// NewProductServiceImpl creates a new product service implementation for IProductService interface
func NewProductServiceImpl(db *database.Queries) service.IProductService {
	ps := &productService{
		db:              db,
		productRegistry: make(map[int32]productCreator),
	}

	// Register product types
	ps.registerProductType(service.ProductTypeMushroom, createMushroomProduct)
	ps.registerProductType(service.ProductTypeVegetable, createVegetableProduct)

	return &productServiceWrapper{ps: ps}
}

// NewProductServiceImplWithFileTracking creates a new product service implementation with file tracking
func NewProductServiceImplWithFileTracking(db *database.Queries, fileTrackingService file_tracking.FileTrackingService) service.IProductService {
	ps := &productService{
		db:              db,
		productRegistry: make(map[int32]productCreator),
	}

	// Register product types
	ps.registerProductType(service.ProductTypeMushroom, createMushroomProduct)
	ps.registerProductType(service.ProductTypeVegetable, createVegetableProduct)
	ps.registerProductType(service.ProductTypeBonsai, createBonsaiProduct)

	return &productServiceWrapper{
		ps: ps,
		fileTrackingService: fileTrackingService,
	}
}

func (w *productServiceWrapper) CreateProduct(ctx context.Context, in *productVO.CreateProductRequest) (codeResult int, out productVO.ProductResponse, err error) {
	// Convert CreateProductRequest to database.CreateProductParams
	params := database.CreateProductParams{
		ProductName:            in.ProductName,
		ProductPrice:           in.ProductPrice,
		ProductThumb:           in.ProductThumb,
		ProductPictures:        in.ProductPictures,
		ProductVideos:          in.ProductVideos,
		ProductType:            in.ProductType,
		SubProductType:         in.SubProductType,
		ProductDiscountedPrice: in.ProductDiscountedPrice,
		ProductAttributes:      in.ProductAttributes,
		IsDraft:                sql.NullBool{Bool: in.IsDraft, Valid: true},
		IsPublished:            sql.NullBool{Bool: in.IsPublished, Valid: true},
	}

	// Handle optional fields
	if in.ProductStatus != nil {
		params.ProductStatus = sql.NullInt32{Int32: *in.ProductStatus, Valid: true}
	}
	if in.ProductDescription != nil {
		params.ProductDescription = sql.NullString{String: *in.ProductDescription, Valid: true}
	}
	if in.ProductQuantity != nil {
		params.ProductQuantity = sql.NullInt32{Int32: *in.ProductQuantity, Valid: true}
	}
	if in.Discount != nil {
		params.Discount = sql.NullString{String: *in.Discount, Valid: true}
	}

	// Create product using the underlying service
	product, err := w.ps.CreateProduct(ctx, &params)
	if err != nil {
		return response.ErrCodeInternalServerError, out, err
	}

	// Thêm file references sử dụng helper function
	w.trackEntityFiles(ctx, product.ID, "product", in.ProductThumb, in.ProductPictures)

	// Convert database.Product to ProductResponse using converter functions
	var productVariations json.RawMessage
	if product.ProductVariations.Valid {
		productVariations = product.ProductVariations.RawMessage
	}

	out = productVO.ProductResponse{
		ID:                     product.ID,
		ProductName:            product.ProductName,
		ProductPrice:           product.ProductPrice,
		ProductStatus:          convertSqlNullInt32ToNull(product.ProductStatus),
		ProductThumb:           product.ProductThumb,
		ProductPictures:        product.ProductPictures,
		ProductVideos:          product.ProductVideos,
		ProductRatingsAverage:  convertSqlNullStringToNull(product.ProductRatingsAverage),
		ProductVariations:      productVariations,
		ProductDescription:     convertSqlNullStringToNull(product.ProductDescription),
		ProductSlug:            convertSqlNullStringToNull(product.ProductSlug),
		ProductQuantity:        convertSqlNullInt32ToNull(product.ProductQuantity),
		ProductType:            product.ProductType,
		SubProductType:         product.SubProductType,
		Discount:               convertSqlNullStringToNull(product.Discount),
		ProductDiscountedPrice: product.ProductDiscountedPrice,
		ProductSelled:          convertSqlNullInt32ToNull(product.ProductSelled),
		ProductAttributes:      product.ProductAttributes,
		IsDraft:                convertSqlNullBoolToNull(product.IsDraft),
		IsPublished:            convertSqlNullBoolToNull(product.IsPublished),
		CreatedAt:              product.CreatedAt,
		UpdatedAt:              product.UpdatedAt,
	}

	return response.ErrCodeSuccess, out, nil
}

func (w *productServiceWrapper) GetProduct(ctx context.Context, id int32) (codeResult int, out productVO.ProductResponse, err error) {
	// Get product from database
	product, err := w.ps.GetProduct(ctx, id)
	if err != nil {
		return response.ErrCodeInternalServerError, out, fmt.Errorf("failed to get product: %w", err)
	}

	// Convert to response format - dereference pointer to get value
	productResponse := w.convertDatabaseProductToResponse(*product)

	return response.ErrCodeSuccess, productResponse, nil
}

func (w *productServiceWrapper) ListProducts(ctx context.Context, input *model.PaginationRequest) (codeResult int, out *model.PaginatedResponse[productVO.ProductResponse], err error) {
	// Validate pagination input
	input.Validate()

	// Calculate limit and offset
	limit := int32(input.PageSize)
	offset := int32(input.CalculateOffset())

	// Get products from database
	products, err := w.ps.ListProducts(ctx, limit, offset)
	if err != nil {
		return response.ErrCodeInternalServerError, nil, fmt.Errorf("failed to list products: %w", err)
	}

	// Convert to response format
	productResponses := make([]productVO.ProductResponse, len(products))
	for i, product := range products {
		productResponses[i] = w.convertDatabaseProductToResponse(product)
	}

	// Get total count for pagination
	totalCount, err := w.ps.CountProducts(ctx)
	if err != nil {
		return response.ErrCodeInternalServerError, nil, fmt.Errorf("failed to count products: %w", err)
	}

	// Create paginated response
	paginatedResponse := model.NewPaginatedResponse(productResponses, *input, totalCount, "Products retrieved successfully")

	return response.ErrCodeSuccess, &paginatedResponse, nil
}

func (w *productServiceWrapper) ListProductsWithFilter(ctx context.Context, productType *int32, subProductType *int32, input *model.PaginationRequest) (codeResult int, out *model.PaginatedResponse[productVO.ProductResponse], err error) {
	// Validate pagination input
	input.Validate()

	// Calculate limit and offset
	limit := int32(input.PageSize)
	offset := int32(input.CalculateOffset())

	// Get products from database with filter
	products, err := w.ps.ListProductsWithFilter(ctx, productType, subProductType, limit, offset)
	if err != nil {
		return response.ErrCodeInternalServerError, nil, fmt.Errorf("failed to list products with filter: %w", err)
	}

	// Convert to response format
	productResponses := make([]productVO.ProductResponse, len(products))
	for i, product := range products {
		productResponses[i] = w.convertDatabaseProductToResponse(product)
	}

	// Get total count for pagination (we'll use the same count for now)
	totalCount, err := w.ps.CountProducts(ctx)
	if err != nil {
		return response.ErrCodeInternalServerError, nil, fmt.Errorf("failed to count products: %w", err)
	}

	// Create paginated response
	paginatedResponse := model.NewPaginatedResponse(productResponses, *input, totalCount, "Filtered products retrieved successfully")

	return response.ErrCodeSuccess, &paginatedResponse, nil
}

func (w *productServiceWrapper) UpdateProduct(ctx context.Context, id int32, in *productVO.UpdateProductRequest) (codeResult int, out productVO.ProductResponse, err error) {
	// Lấy sản phẩm hiện tại để có thông tin đầy đủ
	existingProduct, err := w.ps.GetProduct(ctx, id)
	if err != nil {
		return response.ErrCodeInternalServerError, out, fmt.Errorf("failed to get existing product: %w", err)
	}

	// Convert UpdateProductRequest to database.UpdateProductParams
	params := database.UpdateProductParams{
		ID: id,
		// Sử dụng giá trị hiện tại cho các trường bắt buộc
		ProductName: existingProduct.ProductName,
		ProductPrice: existingProduct.ProductPrice,
		ProductThumb: existingProduct.ProductThumb,
		ProductPictures: existingProduct.ProductPictures,
		ProductVideos: existingProduct.ProductVideos,
		ProductType: existingProduct.ProductType,
		SubProductType: existingProduct.SubProductType,
		ProductDiscountedPrice: existingProduct.ProductDiscountedPrice,
	}

	// Xử lý tất cả các trường con trỏ
	if in.ProductName != nil {
		params.ProductName = *in.ProductName
	}
	if in.ProductPrice != nil {
		params.ProductPrice = *in.ProductPrice
		
		// Nếu giá thay đổi nhưng không có giá khuyến mãi mới, tính toán lại giá khuyến mãi
		if in.ProductDiscountedPrice == nil && existingProduct.Discount.Valid {
			// Lấy phần trăm giảm giá
			discountStr := existingProduct.Discount.String
			discount, err := strconv.ParseFloat(discountStr, 64)
			if err == nil && discount > 0 {
				// Chuyển đổi giá mới sang float
				priceFloat, err := strconv.ParseFloat(*in.ProductPrice, 64)
				if err == nil {
					// Tính giá khuyến mãi mới
					discountedPrice := priceFloat * (1 - discount/100)
					// Chuyển đổi lại thành string
					params.ProductDiscountedPrice = fmt.Sprintf("%.0f", discountedPrice)
				}
			}
		}
	}
	if in.ProductThumb != nil {
		params.ProductThumb = *in.ProductThumb
	}
	if in.ProductPictures != nil {
		params.ProductPictures = *in.ProductPictures
	}
	if in.ProductVideos != nil {
		params.ProductVideos = *in.ProductVideos
	}
	if in.ProductType != nil {
		params.ProductType = *in.ProductType
	}
	if in.SubProductType != nil {
		params.SubProductType = *in.SubProductType
	}
	if in.ProductDiscountedPrice != nil {
		params.ProductDiscountedPrice = *in.ProductDiscountedPrice
	}
	if in.ProductAttributes != nil && len(in.ProductAttributes) > 0 {
		params.ProductAttributes = in.ProductAttributes
	} else {
		// Giữ nguyên thuộc tính hiện tại nếu không có thuộc tính mới
		params.ProductAttributes = existingProduct.ProductAttributes
	}
	if in.IsDraft != nil {
		params.IsDraft = sql.NullBool{Bool: *in.IsDraft, Valid: true}
	}
	if in.IsPublished != nil {
		params.IsPublished = sql.NullBool{Bool: *in.IsPublished, Valid: true}
	}
	if in.ProductStatus != nil {
		params.ProductStatus = sql.NullInt32{Int32: *in.ProductStatus, Valid: true}
	}
	if in.ProductDescription != nil {
		params.ProductDescription = sql.NullString{String: *in.ProductDescription, Valid: true}
	}
	if in.ProductQuantity != nil {
		params.ProductQuantity = sql.NullInt32{Int32: *in.ProductQuantity, Valid: true}
	}
	if in.Discount != nil {
		params.Discount = sql.NullString{String: *in.Discount, Valid: true}
		
		// Nếu phần trăm giảm giá thay đổi, tính toán lại giá khuyến mãi
		discount, err := strconv.ParseFloat(*in.Discount, 64)
		if err == nil && discount > 0 {
			// Xác định giá gốc để tính
			priceStr := existingProduct.ProductPrice
			if in.ProductPrice != nil {
				priceStr = *in.ProductPrice
			}
			
			// Chuyển đổi giá sang float
			priceFloat, err := strconv.ParseFloat(priceStr, 64)
			if err == nil {
				// Tính giá khuyến mãi
				discountedPrice := priceFloat * (1 - discount/100)
				// Chuyển đổi lại thành string
				params.ProductDiscountedPrice = fmt.Sprintf("%.0f", discountedPrice)
			}
		}
	}

	// Update product using the underlying service
	product, err := w.ps.UpdateProduct(ctx, &params)
	if err != nil {
		return response.ErrCodeInternalServerError, out, err
	}

	// Update file tracking nếu có thay đổi về files
	if in.ProductThumb != nil || in.ProductPictures != nil {
		oldThumb := existingProduct.ProductThumb
		newThumb := params.ProductThumb
		oldPictures := existingProduct.ProductPictures
		newPictures := params.ProductPictures
		w.updateEntityFileTracking(ctx, id, "product", oldThumb, newThumb, oldPictures, newPictures)
	}

	// Convert database.Product to ProductResponse using converter functions
	var productVariations json.RawMessage
	if product.ProductVariations.Valid {
		productVariations = product.ProductVariations.RawMessage
	}

	out = productVO.ProductResponse{
		ID:                     product.ID,
		ProductName:            product.ProductName,
		ProductPrice:           product.ProductPrice,
		ProductStatus:          convertSqlNullInt32ToNull(product.ProductStatus),
		ProductThumb:           product.ProductThumb,
		ProductPictures:        product.ProductPictures,
		ProductVideos:          product.ProductVideos,
		ProductRatingsAverage:  convertSqlNullStringToNull(product.ProductRatingsAverage),
		ProductVariations:      productVariations,
		ProductDescription:     convertSqlNullStringToNull(product.ProductDescription),
		ProductSlug:            convertSqlNullStringToNull(product.ProductSlug),
		ProductQuantity:        convertSqlNullInt32ToNull(product.ProductQuantity),
		ProductType:            product.ProductType,
		SubProductType:         product.SubProductType,
		Discount:               convertSqlNullStringToNull(product.Discount),
		ProductDiscountedPrice: product.ProductDiscountedPrice,
		ProductSelled:          convertSqlNullInt32ToNull(product.ProductSelled),
		ProductAttributes:      product.ProductAttributes,
		IsDraft:                convertSqlNullBoolToNull(product.IsDraft),
		IsPublished:            convertSqlNullBoolToNull(product.IsPublished),
		CreatedAt:              product.CreatedAt,
		UpdatedAt:              product.UpdatedAt,
	}

	return response.ErrCodeSuccess, out, nil
}

func (w *productServiceWrapper) DeleteProduct(ctx context.Context, id int32) (codeResult int, err error) {
	// Remove file references trước khi xóa sản phẩm
	w.removeEntityFileReferences(ctx, id)

	// Gọi hàm DeleteProduct của lớp productService
	err = w.ps.DeleteProduct(ctx, id)
	if err != nil {
		return response.ErrCodeInternalServerError, fmt.Errorf("failed to delete product: %w", err)
	}

	return response.ErrCodeSuccess, nil
}

func (w *productServiceWrapper) SearchProducts(ctx context.Context, query string, limit, offset int32) (codeResult int, out []productVO.ProductResponse, err error) {
	// Get products from database
	products, err := w.ps.SearchProducts(ctx, query, limit, offset)
	if err != nil {
		return response.ErrCodeInternalServerError, nil, fmt.Errorf("failed to search products: %w", err)
	}

	// Convert to response format
	productResponses := make([]productVO.ProductResponse, len(products))
	for i, product := range products {
		productResponses[i] = w.convertDatabaseProductToResponse(product)
	}

	return response.ErrCodeSuccess, productResponses, nil
}

func (w *productServiceWrapper) FilterProducts(ctx context.Context, in *productVO.FilterProductsRequest) (codeResult int, out []productVO.ProductResponse, err error) {
	// Convert request to database params
	params := database.FilterProductsParams{
		Offset: in.Offset,
		Limit:  in.Limit,
	}

	// Set category filter
	if in.Category != nil {
		// Assuming category maps to product_type
		// You might need to convert category string to product_type ID
		// For now, let's assume it's already an integer string
		params.Category = sql.NullInt32{Valid: false} // TODO: implement category mapping
	}

	// Set price filters - fix the price comparison issue
	if in.MinPrice != nil {
		params.MinPrice = sql.NullString{String: fmt.Sprintf("%.2f", *in.MinPrice), Valid: true}
	}

	if in.MaxPrice != nil {
		params.MaxPrice = sql.NullString{String: fmt.Sprintf("%.2f", *in.MaxPrice), Valid: true}
	}

	// Set stock filter
	if in.InStock != nil {
		params.InStock = sql.NullBool{Bool: *in.InStock, Valid: true}
	}

	// Set sorting
	if in.SortBy != "" {
		params.SortBy = sql.NullString{String: in.SortBy, Valid: true}
	}

	if in.SortOrder != "" {
		params.SortOrder = sql.NullString{String: in.SortOrder, Valid: true}
	}

	// Get products from database
	products, err := w.ps.FilterProducts(ctx, params)
	if err != nil {
		return response.ErrCodeInternalServerError, nil, fmt.Errorf("failed to filter products: %w", err)
	}

	// Convert to response format
	productResponses := make([]productVO.ProductResponse, len(products))
	for i, product := range products {
		productResponses[i] = w.convertDatabaseProductToResponse(product)
	}

	return response.ErrCodeSuccess, productResponses, nil
}

func (w *productServiceWrapper) GetProductStats(ctx context.Context) (codeResult int, out productVO.ProductStats, err error) {
	// Delegate to the underlying productService
	stats, err := w.ps.GetProductStats(ctx)
	if err != nil {
		return response.ErrCodeInternalServerError, out, fmt.Errorf("failed to get product stats: %v", err)
	}

	// Convert productModel.ProductStats to productVO.ProductStats
	var minPrice, maxPrice string
	if stats.MinPrice != nil {
		if val, ok := stats.MinPrice.(float64); ok {
			minPrice = fmt.Sprintf("%.0f", val)
		} else if val, ok := stats.MinPrice.(string); ok {
			minPrice = val
		}
	}
	if stats.MaxPrice != nil {
		if val, ok := stats.MaxPrice.(float64); ok {
			maxPrice = fmt.Sprintf("%.0f", val)
		} else if val, ok := stats.MaxPrice.(string); ok {
			maxPrice = val
		}
	}

	out = productVO.ProductStats{
		TotalProducts:      stats.TotalProducts,
		InStockProducts:    stats.InStockProducts,
		OutOfStockProducts: stats.OutOfStockProducts,
		TotalProductsSold:  stats.TotalProductsSold,
		AverageRating:      stats.AverageRating,
		MinPrice:           minPrice,
		MaxPrice:           maxPrice,
		AvgPrice:           fmt.Sprintf("%.0f", stats.AvgPrice),
		TotalCategories:    stats.TotalCategories,
	}

	return response.ErrCodeSuccess, out, nil
}

func (w *productServiceWrapper) BulkUpdateProducts(ctx context.Context, in []productVO.UpdateProductRequest) (codeResult int, out []productVO.ProductResponse, err error) {
	// Khởi tạo mảng kết quả
	out = make([]productVO.ProductResponse, 0, len(in))

	// Xử lý từng yêu cầu cập nhật
	for _, updateReq := range in {
		// Kiểm tra ID sản phẩm có tồn tại trong request không
		if updateReq.ID == nil {
			return response.ErrCodeParamInvalid, nil, fmt.Errorf("product ID is required for bulk update")
		}
		
		// Lấy ID sản phẩm từ request
		productID := *updateReq.ID
		
		// Gọi hàm UpdateProduct để cập nhật từng sản phẩm
		codeResult, productResp, err := w.UpdateProduct(ctx, productID, &updateReq)
		if err != nil {
			return codeResult, nil, fmt.Errorf("failed to update product %d: %w", productID, err)
		}
		
		// Thêm sản phẩm đã cập nhật vào mảng kết quả
		out = append(out, productResp)
	}

	return response.ErrCodeSuccess, out, nil
}

// convertDatabaseProductToResponse converts database.Product to productVO.ProductResponse
// Updated to accept database.Product (value) instead of *database.Product (pointer) for better performance
func (w *productServiceWrapper) convertDatabaseProductToResponse(dbProduct database.Product) productVO.ProductResponse {
	var productVariations json.RawMessage
	if dbProduct.ProductVariations.Valid {
		productVariations = dbProduct.ProductVariations.RawMessage
	}

	return productVO.ProductResponse{
		ID:                     dbProduct.ID,
		ProductName:            dbProduct.ProductName,
		ProductPrice:           dbProduct.ProductPrice,
		ProductStatus:          convertSqlNullInt32ToNull(dbProduct.ProductStatus),
		ProductThumb:           dbProduct.ProductThumb,
		ProductPictures:        dbProduct.ProductPictures,
		ProductVideos:          dbProduct.ProductVideos,
		ProductRatingsAverage:  convertSqlNullStringToNull(dbProduct.ProductRatingsAverage),
		ProductVariations:      productVariations,
		ProductDescription:     convertSqlNullStringToNull(dbProduct.ProductDescription),
		ProductSlug:            convertSqlNullStringToNull(dbProduct.ProductSlug),
		ProductQuantity:        convertSqlNullInt32ToNull(dbProduct.ProductQuantity),
		ProductType:            dbProduct.ProductType,
		SubProductType:         dbProduct.SubProductType,
		Discount:               convertSqlNullStringToNull(dbProduct.Discount),
		ProductDiscountedPrice: dbProduct.ProductDiscountedPrice,
		ProductSelled:          convertSqlNullInt32ToNull(dbProduct.ProductSelled),
		ProductAttributes:      dbProduct.ProductAttributes,
		IsDraft:                convertSqlNullBoolToNull(dbProduct.IsDraft),
		IsPublished:            convertSqlNullBoolToNull(dbProduct.IsPublished),
		CreatedAt:              dbProduct.CreatedAt,
		UpdatedAt:              dbProduct.UpdatedAt,
	}
}

// Helper functions to convert sql.NullXXX to null.XXX
func convertSqlNullStringToNull(sqlNull sql.NullString) null.String {
	if sqlNull.Valid {
		return null.StringFrom(sqlNull.String)
	}
	return null.String{}
}

func convertSqlNullInt32ToNull(sqlNull sql.NullInt32) null.Int {
	if sqlNull.Valid {
		return null.IntFrom(int64(sqlNull.Int32))
	}
	return null.Int{}
}

func convertSqlNullBoolToNull(sqlNull sql.NullBool) null.Bool {
	if !sqlNull.Valid {
		return null.NewBool(false, false)
	}
	return null.NewBool(sqlNull.Bool, true)
}

// addFileReference thêm file reference cho một file cụ thể
func (w *productServiceWrapper) addFileReference(ctx context.Context, imageURL string, productID int32, fieldName string) error {
	if w.fileTrackingService == nil {
		return fmt.Errorf("file tracking service not initialized")
	}

	// Extract public ID from URL
	publicID := extractPublicIDFromURL(imageURL)
	if publicID == "" {
		return fmt.Errorf("could not extract public ID from URL: %s", imageURL)
	}

	// Get file upload record by public ID
	fileUpload, err := w.fileTrackingService.GetFileUploadByPublicID(ctx, publicID)
	if err != nil {
		return fmt.Errorf("failed to get file upload for publicID %s: %w", publicID, err)
	}

	// Add file reference
	params := file_tracking.AddFileReferenceParams{
		FileID:           fileUpload.ID,
		EntityType:       "product",
		EntityID:         productID,
		FieldName:        &fieldName,
		ReferenceType:    "direct",
		CreatedByUserID:  nil, // TODO: Get from context if available
	}

	if err := w.fileTrackingService.AddFileReference(ctx, params); err != nil {
		return fmt.Errorf("failed to add file reference for publicID %s: %w", publicID, err)
	}

	return nil
}

// Helper function để track files cho một entity
func (w *productServiceWrapper) trackEntityFiles(ctx context.Context, entityID int32, entityType string, thumbURL string, pictureURLs []string) {
	// Track thumb
	if thumbURL != "" {
		if err := w.addFileReference(ctx, thumbURL, entityID, entityType+"_thumb"); err != nil {
			log.Printf("Warning: Failed to add file reference for %s thumb: %v", entityType, err)
		}
	}
	
	// Track pictures
	for _, pictureURL := range pictureURLs {
		if pictureURL != "" {
			if err := w.addFileReference(ctx, pictureURL, entityID, entityType+"_pictures"); err != nil {
				log.Printf("Warning: Failed to add file reference for %s picture: %v", entityType, err)
			}
		}
	}
}

// Helper function để remove file tracking cho một entity
func (w *productServiceWrapper) removeEntityFileReferences(ctx context.Context, entityID int32) {
	if w.fileTrackingService == nil {
		log.Printf("Warning: File tracking service not initialized")
		return
	}

	if err := w.fileTrackingService.BatchRemoveReferences(ctx, "product", entityID); err != nil {
		log.Printf("Warning: Failed to remove file references for entity %d: %v", entityID, err)
	}
}

// Helper function để update file tracking khi files thay đổi
func (w *productServiceWrapper) updateEntityFileTracking(ctx context.Context, entityID int32, entityType string, oldThumb, newThumb string, oldPictures, newPictures []string) {
	// Nếu thumb thay đổi
	if oldThumb != newThumb {
		// Remove old thumb reference nếu có
		if oldThumb != "" {
			w.removeSpecificFileReference(ctx, entityID, oldThumb)
		}
		// Add new thumb reference nếu có
		if newThumb != "" {
			if err := w.addFileReference(ctx, newThumb, entityID, entityType+"_thumb"); err != nil {
				log.Printf("Warning: Failed to add file reference for new %s thumb: %v", entityType, err)
			}
		}
	}

	// Nếu pictures thay đổi
	if !stringSlicesEqual(oldPictures, newPictures) {
		// Remove old picture references
		for _, oldPicture := range oldPictures {
			if oldPicture != "" && !stringSliceContains(newPictures, oldPicture) {
				w.removeSpecificFileReference(ctx, entityID, oldPicture)
			}
		}
		// Add new picture references
		for _, newPicture := range newPictures {
			if newPicture != "" && !stringSliceContains(oldPictures, newPicture) {
				if err := w.addFileReference(ctx, newPicture, entityID, entityType+"_pictures"); err != nil {
					log.Printf("Warning: Failed to add file reference for new %s picture: %v", entityType, err)
				}
			}
		}
	}
}

// Helper function để remove specific file reference
func (w *productServiceWrapper) removeSpecificFileReference(ctx context.Context, entityID int32, imageURL string) {
	if w.fileTrackingService == nil {
		return
	}

	publicID := extractPublicIDFromURL(imageURL)
	if publicID == "" {
		return
	}

	fileUpload, err := w.fileTrackingService.GetFileUploadByPublicID(ctx, publicID)
	if err != nil {
		return
	}

	if err := w.fileTrackingService.RemoveFileReference(ctx, file_tracking.RemoveFileReferenceParams{
		FileID:     fileUpload.ID,
		EntityType: "product",
		EntityID:   entityID,
	}); err != nil {
		log.Printf("Warning: Failed to remove file reference for publicID %s: %v", publicID, err)
	}
}

// Utility functions
func stringSlicesEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func stringSliceContains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// extractPublicIDFromURL extracts public ID from Cloudinary URL
func extractPublicIDFromURL(url string) string {
	if url == "" {
		return ""
	}

	// Handle Cloudinary URLs
	if strings.Contains(url, "cloudinary.com") {
		// Extract public ID from Cloudinary URL
		// Example: https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg
		parts := strings.Split(url, "/")
		for i, part := range parts {
			if part == "upload" && i+1 < len(parts) {
				// Skip version if present (starts with 'v')
				nextPart := parts[i+1]
				if strings.HasPrefix(nextPart, "v") && i+2 < len(parts) {
					// Remove file extension
					fileName := parts[i+2]
					return strings.TrimSuffix(fileName, filepath.Ext(fileName))
				} else {
					// No version, extract directly
					fileName := nextPart
					return strings.TrimSuffix(fileName, filepath.Ext(fileName))
				}
			}
		}
	}

	// For other URLs, try to extract filename without extension
	parts := strings.Split(url, "/")
	if len(parts) > 0 {
		lastPart := parts[len(parts)-1]
		// Remove query parameters
		if idx := strings.Index(lastPart, "?"); idx != -1 {
			lastPart = lastPart[:idx]
		}
		return strings.TrimSuffix(lastPart, filepath.Ext(lastPart))
	}

	return ""
}

// addFileReferences thêm file references cho nhiều files (deprecated, kept for compatibility)
func (w *productServiceWrapper) addFileReferences(ctx context.Context, imageURLs []string, productID int32) error {
	for i, imageURL := range imageURLs {
		if imageURL == "" {
			continue
		}

		// Determine field name based on image position
		fieldName := "product_pictures"
		if i == 0 && len(imageURLs) > 1 {
			// First image might be thumbnail if there are multiple images
			fieldName = "product_thumb"
		}

		if err := w.addFileReference(ctx, imageURL, productID, fieldName); err != nil {
			log.Printf("Failed to add file reference for URL %s: %v", imageURL, err)
			// Continue with other files even if one fails
		}
	}

	return nil
}

// MarkImagesAsUsed - deprecated, kept for backward compatibility
func (w *productServiceWrapper) MarkImagesAsUsed(ctx context.Context, imageURLs ...string) error {
	if len(imageURLs) == 0 {
		return nil
	}

	// Lấy upload service từ service package
	uploadSvc := service.Upload()
	if uploadSvc == nil {
		return fmt.Errorf("upload service is not initialized")
	}

	var errs []error

	// Đánh dấu từng ảnh đã sử dụng
	for _, url := range imageURLs {
		if url == "" {
			continue
		}

		// Gọi phương thức MarkFileAsUsed từ upload service
		if err := uploadSvc.MarkFileAsUsed(ctx, url); err != nil {
			errs = append(errs, fmt.Errorf("failed to mark image as used (%s): %v", url, err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("failed to mark some images as used: %v", errs)
	}

	return nil
}

func (s *productService) registerProductType(productType int32, creator productCreator) {
	s.productRegistry[productType] = creator
}

// CreateProduct creates a product using the standard database params
func (s *productService) CreateProduct(ctx context.Context, params *database.CreateProductParams) (*database.Product, error) {
	product, err := s.db.CreateProduct(ctx, *params)
	if err != nil {
		return nil, err
	}
	return &product, nil
}

// CreateProductWithType creates a product using the factory pattern
func (s *productService) CreateProductWithType(ctx context.Context, productType int32, params interface{}) (*database.Product, error) {
	creator, exists := s.productRegistry[productType]
	if !exists {
		return nil, fmt.Errorf("%w: %d", service.ErrInvalidProductType, productType)
	}

	return creator(ctx, s.db, params)
}

func (s *productService) GetProduct(ctx context.Context, id int32) (*database.Product, error) {
	product, err := s.db.GetProduct(ctx, id)
	if err != nil {
		return nil, err
	}
	return &product, nil
}

func (s *productService) ListProducts(ctx context.Context, limit, offset int32) ([]database.Product, error) {
	// SQLC best practice: Return slice of values directly, no manual pointer conversion
	products, err := s.db.ListProducts(ctx, database.ListProductsParams{
		Column1: limit,
		Offset:  offset,
	})
	if err != nil {
		return nil, err
	}
	// Return slice of values directly - optimal for performance
	return products, nil
}

func (s *productService) CountProducts(ctx context.Context) (int64, error) {
	return s.db.CountProducts(ctx)
}

func (s *productService) ListProductsWithFilter(ctx context.Context, productType *int32, subProductType *int32, limit, offset int32) ([]database.Product, error) {
	var productTypeParam sql.NullInt32
	var subProductTypeParam sql.NullInt32

	if productType != nil {
		productTypeParam = sql.NullInt32{Int32: *productType, Valid: true}
	}

	if subProductType != nil {
		subProductTypeParam = sql.NullInt32{Int32: *subProductType, Valid: true}
	}

	products, err := s.db.ListProductsWithFilter(ctx, database.ListProductsWithFilterParams{
		ProductType:    productTypeParam,
		SubProductType: subProductTypeParam,
		Offset:         offset,
		Limit:          limit,
	})
	if err != nil {
		return nil, err
	}

	// Return slice of values directly - optimal for performance
	return products, nil
}

func (s *productService) UpdateProduct(ctx context.Context, params *database.UpdateProductParams) (*database.Product, error) {
	product, err := s.db.UpdateProduct(ctx, *params)
	if err != nil {
		return nil, err
	}
	return &product, nil
}

// UpdateProductWithType updates a product using the factory pattern
func (s *productService) UpdateProductWithType(ctx context.Context, productType int32, id int32, params interface{}) (*database.Product, error) {
	// First get the existing product
	product, err := s.GetProduct(ctx, id)
	if err != nil {
		return nil, err
	}

	// Check if the product type matches
	if product.ProductType != productType {
		return nil, fmt.Errorf("product type mismatch: expected %d, got %d", productType, product.ProductType)
	}

	// Convert params to the appropriate type based on productType
	switch productType {
	case service.ProductTypeMushroom:
		// Update mushroom attributes
		mushroomAttrs, ok := params.(service.MushroomAttributes)
		if !ok {
			return nil, fmt.Errorf("invalid params type for mushroom product")
		}

		// Lấy sản phẩm hiện tại
		product, err := s.GetProduct(ctx, id)
		if err != nil {
			return nil, err
		}

		// Kiểm tra xem có phải loại Mushroom không
		if product.ProductType != service.ProductTypeMushroom {
			return nil, fmt.Errorf("product type mismatch: expected %d, got %d", service.ProductTypeMushroom, product.ProductType)
		}

		// Cập nhật thuộc tính
		attributes, _ := json.Marshal(mushroomAttrs)

		// Convert to database params
		updateParams := database.UpdateProductParams{
			ID:                id,
			ProductAttributes: attributes,
		}

		// Update product
		_, err = s.db.UpdateProduct(ctx, updateParams)
		if err != nil {
			return nil, err
		}

	case service.ProductTypeVegetable:
		// Update vegetable attributes
		vegetableAttrs, ok := params.(service.VegetableAttributes)
		if !ok {
			return nil, fmt.Errorf("invalid params type for vegetable product")
		}

		// Lấy sản phẩm hiện tại
		product, err := s.GetProduct(ctx, id)
		if err != nil {
			return nil, err
		}

		// Kiểm tra xem có phải loại Vegetable không
		if product.ProductType != service.ProductTypeVegetable {
			return nil, fmt.Errorf("product type mismatch: expected %d, got %d", service.ProductTypeVegetable, product.ProductType)
		}

		// Cập nhật thuộc tính
		attributes, _ := json.Marshal(vegetableAttrs)

		// Convert to database params
		updateParams := database.UpdateProductParams{
			ID:                id,
			ProductAttributes: attributes,
		}

		// Update product
		_, err = s.db.UpdateProduct(ctx, updateParams)
		if err != nil {
			return nil, err
		}

	case service.ProductTypeBonsai:
		// Update bonsai attributes
		bonsaiAttrs, ok := params.(service.BonsaiAttributes)
		if !ok {
			return nil, fmt.Errorf("invalid params type for bonsai product")
		}

		// Lấy sản phẩm hiện tại
		product, err := s.GetProduct(ctx, id)
		if err != nil {
			return nil, err
		}

		// Kiểm tra xem có phải loại Bonsai không
		if product.ProductType != service.ProductTypeBonsai {
			return nil, fmt.Errorf("product type mismatch: expected %d, got %d", service.ProductTypeBonsai, product.ProductType)
		}

		// Cập nhật thuộc tính
		attributes, _ := json.Marshal(bonsaiAttrs)

		// Convert to database params
		updateParams := database.UpdateProductParams{
			ID:                id,
			ProductAttributes: attributes,
		}

		// Update product
		_, err = s.db.UpdateProduct(ctx, updateParams)
		if err != nil {
			return nil, err
		}

	default:
		return nil, fmt.Errorf("%w: %d", service.ErrInvalidProductType, productType)
	}

	// Return the updated product
	return s.GetProduct(ctx, id)
}

func (s *productService) DeleteProduct(ctx context.Context, id int32) error {
	return s.db.DeleteProduct(ctx, id)
}

func (s *productService) SearchProducts(ctx context.Context, query string, limit, offset int32) ([]database.Product, error) {
	products, err := s.db.SearchProducts(ctx, database.SearchProductsParams{
		Column1: sql.NullString{String: query, Valid: true},
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		return nil, err
	}
	// Return slice of values directly - optimal for performance
	return products, nil
}

func (s *productService) FilterProducts(ctx context.Context, params database.FilterProductsParams) ([]database.Product, error) {
	products, err := s.db.FilterProducts(ctx, params)
	if err != nil {
		return nil, err
	}
	// Return slice of values directly - optimal for performance
	return products, nil
}

func (s *productService) GetProductStats(ctx context.Context) (*productModel.ProductStats, error) {
	statsRow, err := s.db.GetProductStats(ctx)
	if err != nil {
		return nil, err
	}

	// Handle type assertions for interface{} fields
	var totalProductsSold int64
	var averageRating float64
	var avgPrice float64
	var minPrice, maxPrice interface{}

	if statsRow.TotalProductsSold != nil {
		if val, ok := statsRow.TotalProductsSold.(int64); ok {
			totalProductsSold = val
		}
	}

	if statsRow.AverageRating != nil {
		if val, ok := statsRow.AverageRating.(float64); ok {
			averageRating = val
		}
	}

	if statsRow.MinPrice != nil {
		minPrice = statsRow.MinPrice
	}

	if statsRow.MaxPrice != nil {
		maxPrice = statsRow.MaxPrice
	}

	if statsRow.AvgPrice != nil {
		if val, ok := statsRow.AvgPrice.(float64); ok {
			avgPrice = val
		}
	}

	stats := &productModel.ProductStats{
		TotalProducts:      statsRow.TotalProducts,
		InStockProducts:    statsRow.InStockProducts,
		OutOfStockProducts: statsRow.OutOfStockProducts,
		TotalProductsSold:  totalProductsSold,
		AverageRating:      averageRating,
		MinPrice:           minPrice,
		MaxPrice:           maxPrice,
		AvgPrice:           avgPrice,
		TotalCategories:    statsRow.TotalCategories,
	}
	return stats, nil
}

// Removed duplicate BulkUpdateProducts method

// BulkUpdateProductsOld - keep old method for backward compatibility
func (s *productService) BulkUpdateProductsOld(ctx context.Context, params []database.UpdateProductParams) ([]*database.Product, error) {
	products := make([]*database.Product, 0, len(params))
	for _, param := range params {
		product, err := s.db.UpdateProduct(ctx, param)
		if err != nil {
			return nil, err
		}
		products = append(products, &product)
	}
	return products, nil
}

type mushroomService struct {
	db *database.Queries
}

type mushroomServiceWrapper struct {
	ms *mushroomService
	fileTrackingService file_tracking.FileTrackingService
}

func NewMushroomService(db *database.Queries) service.MushroomService {
	return &mushroomService{db: db}
}

func NewMushroomServiceWithFileTracking(db *database.Queries, fileTrackingService file_tracking.FileTrackingService) service.MushroomService {
	return &mushroomServiceWrapper{
		ms: &mushroomService{db: db},
		fileTrackingService: fileTrackingService,
	}
}

// Helper methods for mushroomServiceWrapper
func (w *mushroomServiceWrapper) trackMushroomFiles(ctx context.Context, productID int32, thumbURL string, pictureURLs []string) {
	if thumbURL != "" {
		if err := w.addFileReference(ctx, thumbURL, productID, "ProductThumb"); err != nil {
			log.Printf("Failed to add file reference for mushroom thumb %s: %v", thumbURL, err)
		}
	}

	for _, pictureURL := range pictureURLs {
		if pictureURL != "" {
			if err := w.addFileReference(ctx, pictureURL, productID, "ProductPictures"); err != nil {
				log.Printf("Failed to add file reference for mushroom picture %s: %v", pictureURL, err)
			}
		}
	}
}

func (w *mushroomServiceWrapper) addFileReference(ctx context.Context, imageURL string, productID int32, fieldName string) error {
	publicID := extractPublicIDFromURL(imageURL)
	if publicID == "" {
		return fmt.Errorf("could not extract public ID from URL: %s", imageURL)
	}

	uploadFile, err := w.fileTrackingService.GetFileUploadByPublicID(ctx, publicID)
	if err != nil {
		return fmt.Errorf("failed to get upload file by public ID %s: %w", publicID, err)
	}

	fileRef := file_tracking.AddFileReferenceParams{
		FileID:        uploadFile.ID,
		EntityType:    "product",
		EntityID:      productID,
		FieldName:     &fieldName,
		ReferenceType: file_tracking.ReferenceTypeActive,
	}

	err = w.fileTrackingService.AddFileReference(ctx, fileRef)
	if err != nil {
		return fmt.Errorf("failed to add file reference: %w", err)
	}

	return nil
}

func (w *mushroomServiceWrapper) removeMushroomFileReferences(ctx context.Context, productID int32) {
	if err := w.fileTrackingService.BatchRemoveReferences(ctx, "product", productID); err != nil {
		log.Printf("Failed to remove file references for mushroom product %d: %v", productID, err)
	}
}

// Implement MushroomService interface with file tracking
func (w *mushroomServiceWrapper) CreateMushroom(ctx context.Context, name sql.NullString) (*database.Product, error) {
	product, err := w.ms.CreateMushroom(ctx, name)
	if err != nil {
		return nil, err
	}

	// Track files after successful creation
	w.trackMushroomFiles(ctx, product.ID, product.ProductThumb, product.ProductPictures)

	return product, nil
}

func (w *mushroomServiceWrapper) GetMushroom(ctx context.Context, id int32) (*database.Product, error) {
	return w.ms.GetMushroom(ctx, id)
}

func (w *mushroomServiceWrapper) UpdateMushroom(ctx context.Context, params interface{}) (*database.Product, error) {
	// Get old product for comparison
	oldProduct, err := w.ms.GetMushroom(ctx, params.(map[string]interface{})["id"].(int32))
	if err != nil {
		return nil, err
	}

	// Update product
	updatedProduct, err := w.ms.UpdateMushroom(ctx, params)
	if err != nil {
		return nil, err
	}

	// Update file tracking if files changed
	if oldProduct.ProductThumb != updatedProduct.ProductThumb || !stringSlicesEqual(oldProduct.ProductPictures, updatedProduct.ProductPictures) {
		w.removeMushroomFileReferences(ctx, updatedProduct.ID)
		w.trackMushroomFiles(ctx, updatedProduct.ID, updatedProduct.ProductThumb, updatedProduct.ProductPictures)
	}

	return updatedProduct, nil
}

func (w *mushroomServiceWrapper) DeleteMushroom(ctx context.Context, id int32) error {
	// Remove file references before deletion
	w.removeMushroomFileReferences(ctx, id)

	// Delete mushroom
	return w.ms.DeleteMushroom(ctx, id)
}

func (s *mushroomService) CreateMushroom(ctx context.Context, name sql.NullString) (*database.Product, error) {
	// Tạo sản phẩm với loại Mushroom
	attributes, _ := json.Marshal(service.MushroomAttributes{
		Brand: name.String,
	})

	params := database.CreateProductParams{
		ProductName:            name.String,
		ProductPrice:           "0",
		ProductThumb:           "default.jpg",
		ProductPictures:        []string{},
		ProductVideos:          []string{},
		ProductType:            service.ProductTypeMushroom,
		SubProductType:         []int32{},
		ProductDiscountedPrice: "0",
		ProductAttributes:      attributes,
	}

	product, err := s.db.CreateProduct(ctx, params)
	if err != nil {
		return nil, err
	}
	return &product, nil
}

func (s *mushroomService) GetMushroom(ctx context.Context, id int32) (*database.Product, error) {
	// Lấy sản phẩm theo ID và kiểm tra loại
	product, err := s.db.GetProduct(ctx, id)
	if err != nil {
		return nil, err
	}

	// Kiểm tra xem có phải loại Mushroom không
	if product.ProductType != service.ProductTypeMushroom {
		return nil, fmt.Errorf("product is not a mushroom type")
	}

	return &product, nil
}

func (s *mushroomService) UpdateMushroom(ctx context.Context, params interface{}) (*database.Product, error) {
	// Chuyển đổi params sang đúng kiểu
	mushroomParams, ok := params.(service.MushroomAttributes)
	if !ok {
		return nil, fmt.Errorf("invalid params type for mushroom")
	}

	// Lấy ID từ params (giả định rằng params có trường ID)
	id := int32(0) // Cần lấy ID từ params

	// Lấy sản phẩm hiện tại
	product, err := s.db.GetProduct(ctx, id)
	if err != nil {
		return nil, err
	}

	// Kiểm tra xem có phải loại Mushroom không
	if product.ProductType != service.ProductTypeMushroom {
		return nil, fmt.Errorf("product is not a mushroom type")
	}

	// Cập nhật thuộc tính
	attributes, _ := json.Marshal(mushroomParams)

	updateParams := database.UpdateProductParams{
		ID:               id,
		ProductAttributes: attributes,
	}

	updatedProduct, err := s.db.UpdateProduct(ctx, updateParams)
	if err != nil {
		return nil, err
	}

	return &updatedProduct, nil
}

func (s *mushroomService) DeleteMushroom(ctx context.Context, id int32) error {
	// Lấy sản phẩm để kiểm tra loại
	product, err := s.db.GetProduct(ctx, id)
	if err != nil {
		return err
	}

	// Kiểm tra xem có phải loại Mushroom không
	if product.ProductType != service.ProductTypeMushroom {
		return fmt.Errorf("product is not a mushroom type")
	}

	// Xóa sản phẩm
	return s.db.DeleteProduct(ctx, id)
}

type vegetableService struct {
	db *database.Queries
}

type vegetableServiceWrapper struct {
	vs *vegetableService
	fileTrackingService file_tracking.FileTrackingService
}

func NewVegetableService(db *database.Queries) service.VegetableService {
	return &vegetableService{db: db}
}

func NewVegetableServiceWithFileTracking(db *database.Queries, fileTrackingService file_tracking.FileTrackingService) service.VegetableService {
	return &vegetableServiceWrapper{
		vs: &vegetableService{db: db},
		fileTrackingService: fileTrackingService,
	}
}

// Helper methods for vegetableServiceWrapper
func (w *vegetableServiceWrapper) trackVegetableFiles(ctx context.Context, productID int32, thumbURL string, pictureURLs []string) {
	if thumbURL != "" {
		if err := w.addVegetableFileReference(ctx, thumbURL, productID, "ProductThumb"); err != nil {
			log.Printf("Failed to add file reference for vegetable thumb %s: %v", thumbURL, err)
		}
	}

	for _, pictureURL := range pictureURLs {
		if pictureURL != "" {
			if err := w.addVegetableFileReference(ctx, pictureURL, productID, "ProductPictures"); err != nil {
				log.Printf("Failed to add file reference for vegetable picture %s: %v", pictureURL, err)
			}
		}
	}
}

func (w *vegetableServiceWrapper) addVegetableFileReference(ctx context.Context, imageURL string, productID int32, fieldName string) error {
	publicID := extractPublicIDFromURL(imageURL)
	if publicID == "" {
		return fmt.Errorf("could not extract public ID from URL: %s", imageURL)
	}

	uploadFile, err := w.fileTrackingService.GetFileUploadByPublicID(ctx, publicID)
	if err != nil {
		return fmt.Errorf("failed to get upload file by public ID %s: %w", publicID, err)
	}

	fileRef := file_tracking.AddFileReferenceParams{
		FileID:        uploadFile.ID,
		EntityType:    "product",
		EntityID:      productID,
		FieldName:     &fieldName,
		ReferenceType: file_tracking.ReferenceTypeActive,
	}

	err = w.fileTrackingService.AddFileReference(ctx, fileRef)
	if err != nil {
		return fmt.Errorf("failed to add file reference: %w", err)
	}

	return nil
}

func (w *vegetableServiceWrapper) removeVegetableFileReferences(ctx context.Context, productID int32) {
	if err := w.fileTrackingService.BatchRemoveReferences(ctx, "product", productID); err != nil {
		log.Printf("Failed to remove file references for vegetable product %d: %v", productID, err)
	}
}

// Implement VegetableService interface with file tracking
func (w *vegetableServiceWrapper) CreateVegetable(ctx context.Context, name sql.NullString) (*database.Product, error) {
	product, err := w.vs.CreateVegetable(ctx, name)
	if err != nil {
		return nil, err
	}

	// Track files after successful creation
	w.trackVegetableFiles(ctx, product.ID, product.ProductThumb, product.ProductPictures)

	return product, nil
}

func (w *vegetableServiceWrapper) GetVegetable(ctx context.Context, id int32) (*database.Product, error) {
	return w.vs.GetVegetable(ctx, id)
}

func (w *vegetableServiceWrapper) UpdateVegetable(ctx context.Context, params interface{}) (*database.Product, error) {
	// Get old product for comparison
	oldProduct, err := w.vs.GetVegetable(ctx, params.(map[string]interface{})["id"].(int32))
	if err != nil {
		return nil, err
	}

	// Update product
	updatedProduct, err := w.vs.UpdateVegetable(ctx, params)
	if err != nil {
		return nil, err
	}

	// Update file tracking if files changed
	if oldProduct.ProductThumb != updatedProduct.ProductThumb || !stringSlicesEqual(oldProduct.ProductPictures, updatedProduct.ProductPictures) {
		w.removeVegetableFileReferences(ctx, updatedProduct.ID)
		w.trackVegetableFiles(ctx, updatedProduct.ID, updatedProduct.ProductThumb, updatedProduct.ProductPictures)
	}

	return updatedProduct, nil
}

func (w *vegetableServiceWrapper) DeleteVegetable(ctx context.Context, id int32) error {
	// Remove file references before deletion
	w.removeVegetableFileReferences(ctx, id)

	// Delete vegetable
	return w.vs.DeleteVegetable(ctx, id)
}

func (s *vegetableService) CreateVegetable(ctx context.Context, name sql.NullString) (*database.Product, error) {
	// Tạo sản phẩm với loại Vegetable
	attributes, _ := json.Marshal(service.VegetableAttributes{
		Manufacturer: name.String,
	})

	params := database.CreateProductParams{
		ProductName:            name.String,
		ProductPrice:           "0",
		ProductThumb:           "default.jpg",
		ProductPictures:        []string{},
		ProductVideos:          []string{},
		ProductType:            service.ProductTypeVegetable,
		SubProductType:         []int32{},
		ProductDiscountedPrice: "0",
		ProductAttributes:      attributes,
	}

	product, err := s.db.CreateProduct(ctx, params)
	if err != nil {
		return nil, err
	}
	return &product, nil
}

func (s *vegetableService) GetVegetable(ctx context.Context, id int32) (*database.Product, error) {
	// Lấy sản phẩm theo ID và kiểm tra loại
	product, err := s.db.GetProduct(ctx, id)
	if err != nil {
		return nil, err
	}

	// Kiểm tra xem có phải loại Vegetable không
	if product.ProductType != service.ProductTypeVegetable {
		return nil, fmt.Errorf("product is not a vegetable type")
	}

	return &product, nil
}

func (s *vegetableService) UpdateVegetable(ctx context.Context, params interface{}) (*database.Product, error) {
	// Chuyển đổi params sang đúng kiểu
	vegetableParams, ok := params.(service.VegetableAttributes)
	if !ok {
		return nil, fmt.Errorf("invalid params type for vegetable")
	}

	// Lấy ID từ params (giả định rằng params có trường ID)
	id := int32(0) // Cần lấy ID từ params

	// Lấy sản phẩm hiện tại
	product, err := s.db.GetProduct(ctx, id)
	if err != nil {
		return nil, err
	}

	// Kiểm tra xem có phải loại Vegetable không
	if product.ProductType != service.ProductTypeVegetable {
		return nil, fmt.Errorf("product is not a vegetable type")
	}

	// Cập nhật thuộc tính
	attributes, _ := json.Marshal(vegetableParams)

	updateParams := database.UpdateProductParams{
		ID:               id,
		ProductAttributes: attributes,
	}

	updatedProduct, err := s.db.UpdateProduct(ctx, updateParams)
	if err != nil {
		return nil, err
	}

	return &updatedProduct, nil
}

func (s *vegetableService) DeleteVegetable(ctx context.Context, id int32) error {
	// Lấy sản phẩm để kiểm tra loại
	product, err := s.db.GetProduct(ctx, id)
	if err != nil {
		return err
	}

	// Kiểm tra xem có phải loại Vegetable không
	if product.ProductType != service.ProductTypeVegetable {
		return fmt.Errorf("product is not a vegetable type")
	}

	// Xóa sản phẩm
	return s.db.DeleteProduct(ctx, id)
}

type bonsaiService struct {
	db *database.Queries
}

type bonsaiServiceWrapper struct {
	bs *bonsaiService
	fileTrackingService file_tracking.FileTrackingService
}

func NewBonsaiService(db *database.Queries) service.BonsaiService {
	return &bonsaiService{db: db}
}

func NewBonsaiServiceWithFileTracking(db *database.Queries, fileTrackingService file_tracking.FileTrackingService) service.BonsaiService {
	return &bonsaiServiceWrapper{
		bs: &bonsaiService{db: db},
		fileTrackingService: fileTrackingService,
	}
}

// Helper methods for bonsaiServiceWrapper
func (w *bonsaiServiceWrapper) trackBonsaiFiles(ctx context.Context, productID int32, thumbURL string, pictureURLs []string) {
	if thumbURL != "" {
		if err := w.addBonsaiFileReference(ctx, thumbURL, productID, "ProductThumb"); err != nil {
			log.Printf("Failed to add file reference for bonsai thumb %s: %v", thumbURL, err)
		}
	}

	for _, pictureURL := range pictureURLs {
		if pictureURL != "" {
			if err := w.addBonsaiFileReference(ctx, pictureURL, productID, "ProductPictures"); err != nil {
				log.Printf("Failed to add file reference for bonsai picture %s: %v", pictureURL, err)
			}
		}
	}
}

func (w *bonsaiServiceWrapper) addBonsaiFileReference(ctx context.Context, imageURL string, productID int32, fieldName string) error {
	publicID := extractPublicIDFromURL(imageURL)
	if publicID == "" {
		return fmt.Errorf("could not extract public ID from URL: %s", imageURL)
	}

	uploadFile, err := w.fileTrackingService.GetFileUploadByPublicID(ctx, publicID)
	if err != nil {
		return fmt.Errorf("failed to get upload file by public ID %s: %w", publicID, err)
	}

	fileRef := file_tracking.AddFileReferenceParams{
		FileID:        uploadFile.ID,
		EntityType:    "product",
		EntityID:      productID,
		FieldName:     &fieldName,
		ReferenceType: file_tracking.ReferenceTypeActive,
	}

	err = w.fileTrackingService.AddFileReference(ctx, fileRef)
	if err != nil {
		return fmt.Errorf("failed to add file reference: %w", err)
	}

	return nil
}

func (w *bonsaiServiceWrapper) removeBonsaiFileReferences(ctx context.Context, productID int32) {
	if err := w.fileTrackingService.BatchRemoveReferences(ctx, "product", productID); err != nil {
		log.Printf("Failed to remove file references for bonsai product %d: %v", productID, err)
	}
}

// Implement BonsaiService interface with file tracking
func (w *bonsaiServiceWrapper) CreateBonsai(ctx context.Context, name sql.NullString) (*database.Product, error) {
	product, err := w.bs.CreateBonsai(ctx, name)
	if err != nil {
		return nil, err
	}

	// Track files after successful creation
	w.trackBonsaiFiles(ctx, product.ID, product.ProductThumb, product.ProductPictures)

	return product, nil
}

func (w *bonsaiServiceWrapper) GetBonsai(ctx context.Context, id int32) (*database.Product, error) {
	return w.bs.GetBonsai(ctx, id)
}

func (w *bonsaiServiceWrapper) UpdateBonsai(ctx context.Context, params interface{}) (*database.Product, error) {
	// Get old product for comparison
	oldProduct, err := w.bs.GetBonsai(ctx, params.(map[string]interface{})["id"].(int32))
	if err != nil {
		return nil, err
	}

	// Update product
	updatedProduct, err := w.bs.UpdateBonsai(ctx, params)
	if err != nil {
		return nil, err
	}

	// Update file tracking if files changed
	if oldProduct.ProductThumb != updatedProduct.ProductThumb || !stringSlicesEqual(oldProduct.ProductPictures, updatedProduct.ProductPictures) {
		w.removeBonsaiFileReferences(ctx, updatedProduct.ID)
		w.trackBonsaiFiles(ctx, updatedProduct.ID, updatedProduct.ProductThumb, updatedProduct.ProductPictures)
	}

	return updatedProduct, nil
}

func (w *bonsaiServiceWrapper) DeleteBonsai(ctx context.Context, id int32) error {
	// Remove file references before deletion
	w.removeBonsaiFileReferences(ctx, id)

	// Delete bonsai
	return w.bs.DeleteBonsai(ctx, id)
}

func (s *bonsaiService) CreateBonsai(ctx context.Context, name sql.NullString) (*database.Product, error) {
	// Tạo sản phẩm với loại Bonsai
	attributes, _ := json.Marshal(service.BonsaiAttributes{
		Brand: name.String,
	})

	params := database.CreateProductParams{
		ProductName:            name.String,
		ProductPrice:           "0",
		ProductThumb:           "default.jpg",
		ProductPictures:        []string{},
		ProductVideos:          []string{},
		ProductType:            service.ProductTypeBonsai,
		SubProductType:         []int32{},
		ProductDiscountedPrice: "0",
		ProductAttributes:      attributes,
	}

	product, err := s.db.CreateProduct(ctx, params)
	if err != nil {
		return nil, err
	}
	return &product, nil
}

func (s *bonsaiService) GetBonsai(ctx context.Context, id int32) (*database.Product, error) {
	// Lấy sản phẩm theo ID và kiểm tra loại
	product, err := s.db.GetProduct(ctx, id)
	if err != nil {
		return nil, err
	}

	// Kiểm tra xem có phải loại Bonsai không
	if product.ProductType != service.ProductTypeBonsai {
		return nil, fmt.Errorf("product is not a bonsai type")
	}

	return &product, nil
}

func (s *bonsaiService) UpdateBonsai(ctx context.Context, params interface{}) (*database.Product, error) {
	// Chuyển đổi params sang đúng kiểu
	bonsaiParams, ok := params.(service.BonsaiAttributes)
	if !ok {
		return nil, fmt.Errorf("invalid params type for bonsai")
	}

	// Lấy ID từ params (giả định rằng params có trường ID)
	id := int32(0) // Cần lấy ID từ params

	// Lấy sản phẩm hiện tại
	product, err := s.db.GetProduct(ctx, id)
	if err != nil {
		return nil, err
	}

	// Kiểm tra xem có phải loại Bonsai không
	if product.ProductType != service.ProductTypeBonsai {
		return nil, fmt.Errorf("product is not a bonsai type")
	}

	// Cập nhật thuộc tính
	attributes, _ := json.Marshal(bonsaiParams)

	updateParams := database.UpdateProductParams{
		ID:               id,
		ProductAttributes: attributes,
	}

	updatedProduct, err := s.db.UpdateProduct(ctx, updateParams)
	if err != nil {
		return nil, err
	}

	return &updatedProduct, nil
}

func (s *bonsaiService) DeleteBonsai(ctx context.Context, id int32) error {
	// Lấy sản phẩm để kiểm tra loại
	product, err := s.db.GetProduct(ctx, id)
	if err != nil {
		return err
	}

	// Kiểm tra xem có phải loại Bonsai không
	if product.ProductType != service.ProductTypeBonsai {
		return fmt.Errorf("product is not a bonsai type")
	}

	// Xóa sản phẩm
	return s.db.DeleteProduct(ctx, id)
}