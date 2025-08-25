package upload

import (
	"context"
)

// FileTrackingService định nghĩa các phương thức cần thiết từ file tracking service
type FileTrackingService interface {
	// CreateFileUpload tạo mới bản ghi file upload
	CreateFileUpload(ctx context.Context, params interface{}) (interface{}, error)
}
