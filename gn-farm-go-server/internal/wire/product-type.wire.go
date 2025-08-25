//go:build wireinject
// +build wireinject

package wire

import (
	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service"
	"gn-farm-go-server/internal/service/impl/product"

	"github.com/google/wire"
)

var productTypeSet = wire.NewSet(
	product.NewProductTypeService,
	product.NewProductSubtypeService,
	product.NewProductSubtypeRelationService,
)

func InitializeProductTypeService(db *database.Queries) service.ProductTypeService {
	wire.Build(productTypeSet)
	return nil
}

func InitializeProductSubtypeService(db *database.Queries) service.ProductSubtypeService {
	wire.Build(productTypeSet)
	return nil
}

func InitializeProductSubtypeRelationService(db *database.Queries) service.ProductSubtypeRelationService {
	wire.Build(productTypeSet)
	return nil
}
