// +build wireinject
//go:build wireinject

package upload

import (
	"github.com/google/wire"
	"gn-farm-go-server/internal/service/upload"
)

var UploadHandlerSet = wire.NewSet(
	NewUploadHandler,
	wire.Bind(new(UploadHandler), new(*uploadHandler)),
)

func InitUploadHandler(uploadService upload.UploadService) UploadHandler {
	wire.Build(UploadHandlerSet)
	return &uploadHandler{uploadService: uploadService}
}
