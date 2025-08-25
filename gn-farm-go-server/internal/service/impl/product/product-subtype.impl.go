package product

import (
	"context"
	"database/sql"
	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service"
)

// productSubtypeService implements service.ProductSubtypeService
type productSubtypeService struct {
	db *database.Queries
}

// NewProductSubtypeService creates a new product subtype service
func NewProductSubtypeService(db *database.Queries) service.ProductSubtypeService {
	return &productSubtypeService{db: db}
}

func (s *productSubtypeService) GetProductSubtype(ctx context.Context, id int32) (*database.ProductSubtype, error) {
	productSubtype, err := s.db.GetProductSubtype(ctx, id)
	if err != nil {
		return nil, err
	}
	return &productSubtype, nil
}

func (s *productSubtypeService) ListProductSubtypes(ctx context.Context) ([]database.ProductSubtype, error) {
	// SQLC best practice: Return slice of values directly, no manual pointer conversion
	productSubtypes, err := s.db.ListProductSubtypes(ctx)
	if err != nil {
		return nil, err
	}
	// Return slice of values directly - optimal for performance
	return productSubtypes, nil
}

func (s *productSubtypeService) ListProductSubtypesByType(ctx context.Context, productTypeID int32) ([]database.ProductSubtype, error) {
	// SQLC best practice: Return slice of values directly, no manual pointer conversion
	productSubtypes, err := s.db.ListProductSubtypesByType(ctx, productTypeID)
	if err != nil {
		return nil, err
	}
	// Return slice of values directly - optimal for performance
	return productSubtypes, nil
}

func (s *productSubtypeService) CreateProductSubtype(ctx context.Context, name, description string) (*database.ProductSubtype, error) {
	params := database.CreateProductSubtypeParams{
		Name:        name,
		Description: sql.NullString{String: description, Valid: description != ""},
	}
	productSubtype, err := s.db.CreateProductSubtype(ctx, params)
	if err != nil {
		return nil, err
	}
	return &productSubtype, nil
}

func (s *productSubtypeService) UpdateProductSubtype(ctx context.Context, id int32, name, description string) (*database.ProductSubtype, error) {
	params := database.UpdateProductSubtypeParams{
		ID:          id,
		Name:        name,
		Description: sql.NullString{String: description, Valid: description != ""},
	}
	productSubtype, err := s.db.UpdateProductSubtype(ctx, params)
	if err != nil {
		return nil, err
	}
	return &productSubtype, nil
}

func (s *productSubtypeService) DeleteProductSubtype(ctx context.Context, id int32) error {
	return s.db.DeleteProductSubtype(ctx, id)
}

func (s *productSubtypeService) AddProductSubtypeMapping(ctx context.Context, productTypeID, productSubtypeID int32) error {
	params := database.AddProductSubtypeMappingParams{
		ProductTypeID:    productTypeID,
		ProductSubtypeID: productSubtypeID,
	}
	return s.db.AddProductSubtypeMapping(ctx, params)
}

func (s *productSubtypeService) RemoveProductSubtypeMapping(ctx context.Context, productTypeID, productSubtypeID int32) error {
	params := database.RemoveProductSubtypeMappingParams{
		ProductTypeID:    productTypeID,
		ProductSubtypeID: productSubtypeID,
	}
	return s.db.RemoveProductSubtypeMapping(ctx, params)
}
