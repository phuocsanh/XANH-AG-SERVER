package product

import (
	"context"
	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service"
)

// productSubtypeRelationService implements service.ProductSubtypeRelationService
type productSubtypeRelationService struct {
	db *database.Queries
}

// NewProductSubtypeRelationService creates a new product subtype relation service
func NewProductSubtypeRelationService(db *database.Queries) service.ProductSubtypeRelationService {
	return &productSubtypeRelationService{db: db}
}

func (s *productSubtypeRelationService) GetProductSubtypeRelations(ctx context.Context, productID int32) ([]*database.GetProductSubtypeRelationsRow, error) {
	relations, err := s.db.GetProductSubtypeRelations(ctx, productID)
	if err != nil {
		return nil, err
	}
	result := make([]*database.GetProductSubtypeRelationsRow, len(relations))
	for i := range relations {
		result[i] = &relations[i]
	}
	return result, nil
}

func (s *productSubtypeRelationService) AddProductSubtypeRelation(ctx context.Context, productID, productSubtypeID int32) error {
	params := database.AddProductSubtypeRelationParams{
		ProductID:        productID,
		ProductSubtypeID: productSubtypeID,
	}
	return s.db.AddProductSubtypeRelation(ctx, params)
}

func (s *productSubtypeRelationService) RemoveProductSubtypeRelation(ctx context.Context, productID, productSubtypeID int32) error {
	params := database.RemoveProductSubtypeRelationParams{
		ProductID:        productID,
		ProductSubtypeID: productSubtypeID,
	}
	return s.db.RemoveProductSubtypeRelation(ctx, params)
}

func (s *productSubtypeRelationService) RemoveAllProductSubtypeRelations(ctx context.Context, productID int32) error {
	return s.db.RemoveAllProductSubtypeRelations(ctx, productID)
}
