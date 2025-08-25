package service

import (
	"gn-farm-go-server/internal/service/upload"
	"gn-farm-go-server/internal/service/file_tracking"
)

var (
	// uploadService quản lý việc upload file
	uploadService upload.UploadService
	// fileTrackingService quản lý việc tracking file references
	fileTrackingService file_tracking.FileTrackingService
)

// SetUploadService thiết lập upload service
func SetUploadService(service upload.UploadService) {
	uploadService = service
}

// Upload trả về instance của UploadService
func Upload() upload.UploadService {
	return uploadService
}

// SetFileTrackingService thiết lập file tracking service
func SetFileTrackingService(service file_tracking.FileTrackingService) {
	fileTrackingService = service
}

// FileTracking trả về instance của FileTrackingService
func FileTracking() file_tracking.FileTrackingService {
	return fileTrackingService
}
