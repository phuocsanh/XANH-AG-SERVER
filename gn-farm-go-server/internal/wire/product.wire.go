//go:build wireinject
// +build wireinject

package wire

import (
	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service"
	"gn-farm-go-server/internal/service/impl/product"

	"github.com/google/wire"
)

var productSet = wire.NewSet(
        product.NewProductServiceImpl,
        product.NewMushroomService,
        product.NewVegetableService,
        product.NewBonsaiService,
)

func InitializeProductService(db *database.Queries) service.IProductService {
        wire.Build(productSet)
        return nil
}

func InitializeMushroomService(db *database.Queries) service.MushroomService {
        wire.Build(productSet)
        return nil
}

func InitializeVegetableService(db *database.Queries) service.VegetableService {
        wire.Build(productSet)
        return nil
}

func InitializeBonsaiService(db *database.Queries) service.BonsaiService {
        wire.Build(productSet)
        return nil
}
