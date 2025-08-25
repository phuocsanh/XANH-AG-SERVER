//go:build wireinject
// +build wireinject

package wire

import (
	"gn-farm-go-server/internal/controller/sales"
	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service"
	salesImpl "gn-farm-go-server/internal/service/impl/sales"

	"github.com/google/wire"
)

var salesSet = wire.NewSet(
	salesImpl.NewSalesService,
	sales.NewSalesController,
)

func InitializeSalesService(db *database.Queries) service.ISalesService {
	wire.Build(salesSet)
	return nil
}

func InitializeSalesController(db *database.Queries) *sales.SalesController {
	wire.Build(salesSet)
	return nil
}