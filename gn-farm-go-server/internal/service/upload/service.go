package upload

import (
	"context"
	"mime/multipart"

	"github.com/gin-gonic/gin"
)

// UploadResult contains the result of a file upload
type UploadResult struct {
	PublicID   string `json:"public_id"`
	SecureURL  string `json:"secure_url"`
	URL        string `json:"url"`
	Format     string `json:"format"`
	FileSize   int64  `json:"file_size"`
	FileName   string `json:"file_name"`
	Folder     string `json:"folder"`
}

type UploadService interface {
	// UploadImage uploads an image file and returns the upload result
	UploadImage(ctx *gin.Context, file *multipart.FileHeader, folder string) (*UploadResult, error)
	
	// UploadFile uploads a file to cloud storage
	UploadFile(ctx context.Context, file []byte, filename, folder string) (string, error)
	
	// DeleteFile deletes a file from cloud storage
	DeleteFile(ctx context.Context, publicID string) error
	
	// UpdateTags updates tags of a file
	UpdateTags(ctx context.Context, publicID string, tags []string) error
	
	// MarkFileAsUsed marks a file as used by updating its tags
	MarkFileAsUsed(ctx context.Context, imageURL string) error
	
	// CleanupUnusedFiles removes temporary files older than specified days
	CleanupUnusedFiles(ctx context.Context, daysOld int) error
}
