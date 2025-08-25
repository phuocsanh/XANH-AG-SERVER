package upload

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/admin"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
)

type CloudinaryService struct {
	cld              *cloudinary.Cloudinary
	fileTrackingSvc FileTrackingService
}

// NewCloudinaryService tạo mới một instance của CloudinaryService
func NewCloudinaryService(cfg *UploadConfig, fileTrackingSvc FileTrackingService) (*CloudinaryService, error) {
	if cfg == nil {
		return nil, fmt.Errorf("cloudinary config is required")
	}

	// Validate required config
	if cfg.CloudName == "" || cfg.APIKey == "" || cfg.APISecret == "" {
		return nil, fmt.Errorf("missing required cloudinary configuration")
	}

	cld, err := cloudinary.NewFromParams(cfg.CloudName, cfg.APIKey, cfg.APISecret)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Cloudinary: %v", err)
	}

	return &CloudinaryService{
		cld:             cld,
		fileTrackingSvc: fileTrackingSvc,
	}, nil
}

// SetFileTrackingService sets the file tracking service after initialization
func (s *CloudinaryService) SetFileTrackingService(fileTrackingSvc FileTrackingService) {
	s.fileTrackingSvc = fileTrackingSvc
}

func (s *CloudinaryService) UploadImage(c *gin.Context, file *multipart.FileHeader, folder string) (*UploadResult, error) {
	// Mở file
	src, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %v", err)
	}
	defer src.Close()

	// Đọc toàn bộ file vào bộ nhớ
	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %v", err)
	}

	// Tạo public ID từ tên file (bỏ đuôi)
	ext := filepath.Ext(file.Filename)
	publicID := strings.TrimSuffix(file.Filename, ext)

	// Tạo một reader từ byte slice
	reader := bytes.NewReader(fileBytes)

	// Upload lên Cloudinary với tag tạm thời
	result, err := s.cld.Upload.Upload(
		c.Request.Context(),
		reader,
		uploader.UploadParams{
			Folder:   folder,
			PublicID: publicID,
			Tags:     []string{"temporary"}, // Đánh dấu là file tạm thời
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to upload file to Cloudinary: %v", err)
	}

	// Tạo UploadResult
	uploadResult := &UploadResult{
		PublicID:  result.PublicID,
		SecureURL: result.SecureURL,
		URL:       result.URL,
		Format:    result.Format,
		FileSize:  int64(len(fileBytes)),
		FileName:  file.Filename,
		Folder:    folder,
	}

	// Lưu thông tin file vào database nếu có file tracking service
	if s.fileTrackingSvc != nil {
		// Tạo params cho CreateFileUpload
		params := map[string]interface{}{
			"public_id": result.PublicID,
			"file_url":  result.SecureURL,
			"file_name": file.Filename,
			"file_type": ext,
			"file_size": int64(len(fileBytes)),
			"folder":    folder,
			"mime_type": result.Format,
			"tags":      []string{"temporary"},
		}

		_, err = s.fileTrackingSvc.CreateFileUpload(c.Request.Context(), params)
		if err != nil {
			log.Printf("Failed to save file upload info to database: %v", err)
			// Không trả về lỗi vì file đã upload thành công lên Cloudinary
		}
	}

	return uploadResult, nil
}

func (s *CloudinaryService) UploadFile(ctx context.Context, file []byte, filename, folder string) (string, error) {
	// Tạo public ID từ tên file (bỏ đuôi)
	ext := filepath.Ext(filename)
	publicID := strings.TrimSuffix(filename, ext)

	// Tạo một reader từ byte slice
	reader := bytes.NewReader(file)

	// Upload lên Cloudinary với tag tạm thời
	result, err := s.cld.Upload.Upload(
		ctx,
		reader,
		uploader.UploadParams{
			Folder:   folder,
			PublicID: publicID,
			Tags:     []string{"temporary"}, // Đánh dấu là file tạm thời
		},
	)
	if err != nil {
		return "", fmt.Errorf("failed to upload file to Cloudinary: %v", err)
	}

	// Lưu thông tin file vào database nếu có file tracking service
	if s.fileTrackingSvc != nil {
		// Tạo params cho CreateFileUpload
		params := map[string]interface{}{
			"public_id": publicID,
			"file_url":  result.SecureURL,
			"file_name": filename,
			"file_type": ext,
			"file_size": int64(len(file)),
			"folder":    folder,
			"mime_type": result.Format,
			"tags":      []string{"temporary"},
		}

		_, err = s.fileTrackingSvc.CreateFileUpload(ctx, params)
		if err != nil {
			log.Printf("Failed to save file upload info to database: %v", err)
			// Không trả về lỗi vì file đã upload thành công lên Cloudinary
		}
	}

	return result.SecureURL, nil
}

func (s *CloudinaryService) DeleteFile(ctx context.Context, publicID string) error {
	invalidate := true
	_, err := s.cld.Upload.Destroy(ctx, uploader.DestroyParams{
		PublicID:   publicID,
		Invalidate: &invalidate, // Xóa cache CDN
	})

	if err != nil {
		return fmt.Errorf("failed to delete file from Cloudinary: %v", err)
	}

	return nil
}

func (s *CloudinaryService) UpdateTags(ctx context.Context, publicID string, tags []string) error {
	_, err := s.cld.Admin.UpdateAsset(ctx, admin.UpdateAssetParams{
		PublicID: publicID,
		Tags:     tags,
	})

	if err != nil {
		return fmt.Errorf("failed to update tags: %v", err)
	}

	return nil
}

// ExtractPublicIDFromURL trích xuất public_id từ URL Cloudinary
func (s *CloudinaryService) ExtractPublicIDFromURL(url string) (string, error) {
	// Mẫu URL Cloudinary: https://res.cloudinary.com/<cloud_name>/<resource_type>/upload/v<version>/<public_id>.<extension>
	re := regexp.MustCompile(`/upload/(?:[^/]+/)*([^/.]+)(?:\.[^/]+)?$`)
	matches := re.FindStringSubmatch(url)
	if len(matches) < 2 {
		return "", fmt.Errorf("invalid Cloudinary URL")
	}
	
	// Loại bỏ các tham số nếu có
	publicID := strings.Split(matches[1], "?")[0]
	return publicID, nil
}

// MarkFileAsUsed đánh dấu file đã sử dụng bằng cách đổi tag từ "temporary" sang "in_use"
func (s *CloudinaryService) MarkFileAsUsed(ctx context.Context, imageURL string) error {
	if imageURL == "" {
		return nil // Không có ảnh
	}

	// Trích xuất public_id từ URL
	publicID, err := s.ExtractPublicIDFromURL(imageURL)
	if err != nil {
		return fmt.Errorf("invalid image URL: %v", err)
	}

	// Cập nhật tag
	_, err = s.cld.Admin.UpdateAsset(ctx, admin.UpdateAssetParams{
		PublicID: publicID,
		Tags:     []string{"in_use"},
	})

	if err != nil {
		return fmt.Errorf("failed to mark file as used: %v", err)
	}

	return nil
}

func (s *CloudinaryService) CleanupUnusedFiles(ctx context.Context, daysOld int) error {
	// Lấy danh sách các resource có tag "temporary"
	result, err := s.cld.Admin.AssetsByTag(ctx, admin.AssetsByTagParams{
		Tag:        "temporary",
		MaxResults: 100, // Giới hạn số lượng file mỗi lần xử lý
	})

	if err != nil {
		return fmt.Errorf("failed to list resources: %v", err)
	}

	var deleteErrors []error

	// Lặp qua từng resource và kiểm tra thời gian tạo
	for _, asset := range result.Assets {
		// Kiểm tra nếu file đã tồn tại lâu hơn số ngày quy định
		if time.Since(asset.CreatedAt) > time.Duration(daysOld)*24*time.Hour {
			// Xóa file
			if err := s.DeleteFile(ctx, asset.PublicID); err != nil {
				deleteErrors = append(deleteErrors, fmt.Errorf("failed to delete %s: %v", asset.PublicID, err))
			} else {
				log.Printf("Deleted unused file: %s (created at %s)", asset.PublicID, asset.CreatedAt)
			}
		}
	}

	if len(deleteErrors) > 0 {
		return fmt.Errorf("encountered %d errors during cleanup: %v", len(deleteErrors), deleteErrors)
	}

	return nil
}
