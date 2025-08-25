package product

import (
	"context"
	"database/sql"
	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service"
	"gn-farm-go-server/internal/vo/product"
	"gn-farm-go-server/pkg/response"
)

// productTypeService implements service.ProductTypeService
type productTypeService struct {
	db *database.Queries
}

// NewProductTypeService creates a new product type service
func NewProductTypeService(db *database.Queries) service.ProductTypeService {
	return &productTypeService{db: db}
}

func (s *productTypeService) GetProductType(ctx context.Context, id int32) (codeResult int, out product.ProductTypeResponse, err error) {
	dbProductType, err := s.db.GetProductType(ctx, id)
	if err != nil {
		return response.ErrCodeInternalServerError, out, err
	}

	// Convert to response format
	out = product.ProductTypeResponse{
		ID:          dbProductType.ID,
		Name:        dbProductType.Name,
		Description: convertSqlNullStringToNull(dbProductType.Description),
		ImageURL:    convertSqlNullStringToNull(dbProductType.ImageUrl),
		CreatedAt:   dbProductType.CreatedAt,
		UpdatedAt:   dbProductType.UpdatedAt,
	}

	return response.ErrCodeSuccess, out, nil
}

func (s *productTypeService) ListProductTypes(ctx context.Context) (codeResult int, out []product.ProductTypeResponse, err error) {
	// SQLC best practice: Return slice of values directly, no manual pointer conversion
	dbProductTypes, err := s.db.ListProductTypes(ctx)
	if err != nil {
		return response.ErrCodeInternalServerError, nil, err
	}

	// Convert to response format
	out = make([]product.ProductTypeResponse, len(dbProductTypes))
	for i, pt := range dbProductTypes {
		out[i] = product.ProductTypeResponse{
			ID:          pt.ID,
			Name:        pt.Name,
			Description: convertSqlNullStringToNull(pt.Description),
			ImageURL:    convertSqlNullStringToNull(pt.ImageUrl),
			CreatedAt:   pt.CreatedAt,
			UpdatedAt:   pt.UpdatedAt,
		}
	}

	return response.ErrCodeSuccess, out, nil
}

func (s *productTypeService) CreateProductType(ctx context.Context, req *product.ProductTypeRequest) (codeResult int, out product.ProductTypeResponse, err error) {
	params := database.CreateProductTypeParams{
		Name:        req.Name,
		Description: sql.NullString{String: req.Description, Valid: req.Description != ""},
		ImageUrl:    sql.NullString{String: req.ImageURL, Valid: req.ImageURL != ""},
	}

	dbProductType, err := s.db.CreateProductType(ctx, params)
	if err != nil {
		return response.ErrCodeInternalServerError, out, err
	}

	// Convert to response format
	out = product.ProductTypeResponse{
		ID:          dbProductType.ID,
		Name:        dbProductType.Name,
		Description: convertSqlNullStringToNull(dbProductType.Description),
		ImageURL:    convertSqlNullStringToNull(dbProductType.ImageUrl),
		CreatedAt:   dbProductType.CreatedAt,
		UpdatedAt:   dbProductType.UpdatedAt,
	}

	return response.ErrCodeSuccess, out, nil
}

func (s *productTypeService) UpdateProductType(ctx context.Context, id int32, req *product.ProductTypeRequest) (codeResult int, out product.ProductTypeResponse, err error) {
	params := database.UpdateProductTypeParams{
		ID:          id,
		Name:        req.Name,
		Description: sql.NullString{String: req.Description, Valid: req.Description != ""},
		ImageUrl:    sql.NullString{String: req.ImageURL, Valid: req.ImageURL != ""},
	}

	dbProductType, err := s.db.UpdateProductType(ctx, params)
	if err != nil {
		return response.ErrCodeInternalServerError, out, err
	}

	// Convert to response format
	out = product.ProductTypeResponse{
		ID:          dbProductType.ID,
		Name:        dbProductType.Name,
		Description: convertSqlNullStringToNull(dbProductType.Description),
		ImageURL:    convertSqlNullStringToNull(dbProductType.ImageUrl),
		CreatedAt:   dbProductType.CreatedAt,
		UpdatedAt:   dbProductType.UpdatedAt,
	}

	return response.ErrCodeSuccess, out, nil
}

func (s *productTypeService) DeleteProductType(ctx context.Context, id int32) (codeResult int, err error) {
	err = s.db.DeleteProductType(ctx, id)
	if err != nil {
		return response.ErrCodeInternalServerError, err
	}
	return response.ErrCodeSuccess, nil
}


