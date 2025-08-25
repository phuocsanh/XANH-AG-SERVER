package upload

import "os"

// UploadConfig chứa cấu hình cho upload service
type UploadConfig struct {
	CloudName string
	APIKey    string
	APISecret string
}

// ProvideConfig cung cấp cấu hình từ biến môi trường
func ProvideConfig() (*UploadConfig, error) {
	return &UploadConfig{
		CloudName: os.Getenv("CLOUDINARY_CLOUD_NAME"),
		APIKey:    os.Getenv("CLOUDINARY_API_KEY"),
		APISecret: os.Getenv("CLOUDINARY_API_SECRET"),
	}, nil
}
