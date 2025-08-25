package file_tracking

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"gn-farm-go-server/internal/database"
)

// FileTrackingHelper provides utility functions for file tracking integration
type FileTrackingHelper struct {
	fileService FileTrackingService
}

// NewFileTrackingHelper creates a new file tracking helper
func NewFileTrackingHelper(fileService FileTrackingService) *FileTrackingHelper {
	return &FileTrackingHelper{
		fileService: fileService,
	}
}

// TrackUploadedFile tracks a newly uploaded file and creates initial references
func (h *FileTrackingHelper) TrackUploadedFile(
	ctx context.Context,
	publicID, fileURL, fileName, fileType string,
	fileSize int64,
	userID *int32,
	entityType string,
	entityID int32,
	fieldName *string,
	metadata map[string]interface{},
) (*database.FileUpload, error) {
	// Determine file info from URL/name
	mimeType := h.getMimeTypeFromFileName(fileName)
	folder := h.extractFolderFromURL(fileURL)
	tags := h.generateTagsFromMetadata(metadata)

	// Check if file is temporary based on tags
	isTemporary := h.containsTag(tags, "temporary")

	// Create file upload record
	fileUpload, err := h.fileService.CreateFileUpload(ctx, CreateFileUploadParams{
		PublicID:          publicID,
		FileURL:           fileURL,
		FileName:          fileName,
		FileType:          fileType,
		FileSize:          fileSize,
		Folder:            folder,
		MimeType:          &mimeType,
		UploadedByUserID:  userID,
		Tags:              tags,
		Metadata:          metadata,
		IsTemporary:       &isTemporary,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create file upload: %w", err)
	}

	// Add initial reference if entity info provided
	if entityType != "" && entityID > 0 {
		err = h.fileService.AddFileReference(ctx, AddFileReferenceParams{
			FileID:           fileUpload.ID,
			EntityType:       entityType,
			EntityID:         entityID,
			FieldName:        fieldName,
			ReferenceType:    "primary",
			CreatedByUserID:  userID,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to add file reference: %w", err)
		}
	}

	return fileUpload, nil
}

// UpdateEntityFileReferences updates file references for an entity
func (h *FileTrackingHelper) UpdateEntityFileReferences(
	ctx context.Context,
	entityType string,
	entityID int32,
	fieldName string,
	oldFileURLs []string,
	newFileURLs []string,
	userID *int32,
) error {
	// Get file IDs for old URLs
	oldFileIDs, err := h.getFileIDsByURLs(ctx, oldFileURLs)
	if err != nil {
		return fmt.Errorf("failed to get old file IDs: %w", err)
	}

	// Get file IDs for new URLs
	newFileIDs, err := h.getFileIDsByURLs(ctx, newFileURLs)
	if err != nil {
		return fmt.Errorf("failed to get new file IDs: %w", err)
	}

	// Remove references for files no longer used
	for _, fileID := range oldFileIDs {
		if !h.containsFileID(newFileIDs, fileID) {
			err = h.fileService.RemoveFileReference(ctx, RemoveFileReferenceParams{
				FileID:            fileID,
				EntityType:        entityType,
				EntityID:          entityID,
				DeletedByUserID:   userID,
			})
			if err != nil {
				return fmt.Errorf("failed to remove file reference for file %d: %w", fileID, err)
			}
		}
	}

	// Add references for new files
	for _, fileID := range newFileIDs {
		if !h.containsFileID(oldFileIDs, fileID) {
			err = h.fileService.AddFileReference(ctx, AddFileReferenceParams{
				FileID:           fileID,
				EntityType:       entityType,
				EntityID:         entityID,
				FieldName:        &fieldName,
				ReferenceType:    "primary",
				CreatedByUserID:  userID,
			})
			if err != nil {
				return fmt.Errorf("failed to add file reference for file %d: %w", fileID, err)
			}
		}
	}

	return nil
}

// RemoveEntityFileReferences removes all file references for an entity
func (h *FileTrackingHelper) RemoveEntityFileReferences(
	ctx context.Context,
	entityType string,
	entityID int32,
	userID *int32,
) error {
	return h.fileService.BatchRemoveReferences(ctx, entityType, entityID)
}

// GetEntityFiles gets all files referenced by an entity
func (h *FileTrackingHelper) GetEntityFiles(
	ctx context.Context,
	entityType string,
	entityID int32,
) ([]database.GetFileReferencesRow, error) {
	return h.fileService.GetFileReferences(ctx, entityType, entityID)
}

// CleanupTemporaryFiles performs cleanup of temporary files
func (h *FileTrackingHelper) CleanupTemporaryFiles(
	ctx context.Context,
	maxAge time.Duration,
) (*CleanupResult, error) {
	return h.fileService.CleanupTemporaryFiles(ctx, maxAge)
}

// CleanupOrphanedFiles performs cleanup of orphaned files
func (h *FileTrackingHelper) CleanupOrphanedFiles(
	ctx context.Context,
	gracePeriod time.Duration,
) (*CleanupResult, error) {
	return h.fileService.CleanupOrphanedFiles(ctx, gracePeriod)
}

// GetFileStatistics returns file usage statistics
func (h *FileTrackingHelper) GetFileStatistics(ctx context.Context) (*database.GetFileStatisticsRow, error) {
	return h.fileService.GetFileStatistics(ctx)
}

// Helper methods

// getFileIDsByURLs converts file URLs to file IDs
func (h *FileTrackingHelper) getFileIDsByURLs(ctx context.Context, urls []string) ([]int32, error) {
	var fileIDs []int32
	for _, url := range urls {
		if url == "" {
			continue
		}
		
		// Extract public ID from URL
		publicID := h.extractPublicIDFromURL(url)
		if publicID == "" {
			continue
		}
		
		// Get file by public ID
		file, err := h.fileService.GetFileUploadByPublicID(ctx, publicID)
		if err != nil {
			// File not found in tracking system, skip
			continue
		}
		
		fileIDs = append(fileIDs, file.ID)
	}
	return fileIDs, nil
}

// containsFileID checks if a slice contains a specific file ID
func (h *FileTrackingHelper) containsFileID(fileIDs []int32, targetID int32) bool {
	for _, id := range fileIDs {
		if id == targetID {
			return true
		}
	}
	return false
}

// extractPublicIDFromURL extracts Cloudinary public ID from URL
func (h *FileTrackingHelper) extractPublicIDFromURL(url string) string {
	if url == "" {
		return ""
	}
	
	// Handle Cloudinary URLs
	if strings.Contains(url, "cloudinary.com") {
		// Extract public ID from Cloudinary URL
		// Example: https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg
		parts := strings.Split(url, "/")
		for i, part := range parts {
			if part == "upload" && i+1 < len(parts) {
				// Skip version if present (starts with 'v')
				nextPart := parts[i+1]
				if strings.HasPrefix(nextPart, "v") && i+2 < len(parts) {
					// Remove file extension
					fileName := parts[i+2]
					return strings.TrimSuffix(fileName, filepath.Ext(fileName))
				} else {
					// Remove file extension
					return strings.TrimSuffix(nextPart, filepath.Ext(nextPart))
				}
			}
		}
	}
	
	// For other URLs, use the filename without extension as public ID
	fileName := filepath.Base(url)
	return strings.TrimSuffix(fileName, filepath.Ext(fileName))
}

// extractFolderFromURL extracts folder path from URL
func (h *FileTrackingHelper) extractFolderFromURL(url string) *string {
	if url == "" {
		return nil
	}
	
	// Handle Cloudinary URLs
	if strings.Contains(url, "cloudinary.com") {
		parts := strings.Split(url, "/")
		for i, part := range parts {
			if part == "upload" && i+1 < len(parts) {
				// Check if there's a folder structure after upload
				nextPart := parts[i+1]
				if strings.HasPrefix(nextPart, "v") && i+2 < len(parts) {
					// Version present, check for folder after version
					if i+3 < len(parts) {
						// Extract folder path
						folderParts := parts[i+2 : len(parts)-1]
						if len(folderParts) > 0 {
							folder := strings.Join(folderParts, "/")
							return &folder
						}
					}
				} else {
					// No version, check for folder
					if i+2 < len(parts) {
						folderParts := parts[i+1 : len(parts)-1]
						if len(folderParts) > 0 {
							folder := strings.Join(folderParts, "/")
							return &folder
						}
					}
				}
				break
			}
		}
	}
	
	return nil
}

// getMimeTypeFromFileName determines MIME type from file extension
func (h *FileTrackingHelper) getMimeTypeFromFileName(fileName string) string {
	ext := strings.ToLower(filepath.Ext(fileName))
	
	mimeTypes := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".webp": "image/webp",
		".svg":  "image/svg+xml",
		".pdf":  "application/pdf",
		".doc":  "application/msword",
		".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		".xls":  "application/vnd.ms-excel",
		".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		".mp4":  "video/mp4",
		".avi":  "video/x-msvideo",
		".mov":  "video/quicktime",
		".mp3":  "audio/mpeg",
		".wav":  "audio/wav",
		".txt":  "text/plain",
		".csv":  "text/csv",
		".json": "application/json",
		".xml":  "application/xml",
		".zip":  "application/zip",
		".rar":  "application/x-rar-compressed",
	}
	
	if mimeType, exists := mimeTypes[ext]; exists {
		return mimeType
	}
	
	return "application/octet-stream"
}

// generateTagsFromMetadata generates tags from metadata
func (h *FileTrackingHelper) generateTagsFromMetadata(metadata map[string]interface{}) []string {
	var tags []string
	
	// Extract common tags from metadata
	if category, ok := metadata["category"].(string); ok && category != "" {
		tags = append(tags, category)
	}
	
	if fileType, ok := metadata["type"].(string); ok && fileType != "" {
		tags = append(tags, fileType)
	}
	
	if source, ok := metadata["source"].(string); ok && source != "" {
		tags = append(tags, source)
	}
	
	if userTags, ok := metadata["tags"].([]string); ok {
		tags = append(tags, userTags...)
	}
	
	return tags
}

// FileURLExtractor helps extract file URLs from various data structures
type FileURLExtractor struct{}

// NewFileURLExtractor creates a new file URL extractor
func NewFileURLExtractor() *FileURLExtractor {
	return &FileURLExtractor{}
}

// ExtractFromProductData extracts file URLs from product data
func (e *FileURLExtractor) ExtractFromProductData(data map[string]interface{}) []string {
	var urls []string
	
	// Extract product thumbnail
	if thumb, ok := data["product_thumb"].(string); ok && thumb != "" {
		urls = append(urls, thumb)
	}
	
	// Extract product pictures
	if pictures, ok := data["product_pictures"].([]interface{}); ok {
		for _, pic := range pictures {
			if picURL, ok := pic.(string); ok && picURL != "" {
				urls = append(urls, picURL)
			}
		}
	}
	
	// Extract product videos
	if videos, ok := data["product_videos"].([]interface{}); ok {
		for _, vid := range videos {
			if vidURL, ok := vid.(string); ok && vidURL != "" {
				urls = append(urls, vidURL)
			}
		}
	}
	
	return urls
}

// ExtractFromUserData extracts file URLs from user data
func (e *FileURLExtractor) ExtractFromUserData(data map[string]interface{}) []string {
	var urls []string
	
	// Extract avatar
	if avatar, ok := data["avatar"].(string); ok && avatar != "" {
		urls = append(urls, avatar)
	}
	
	// Extract cover image
	if cover, ok := data["cover_image"].(string); ok && cover != "" {
		urls = append(urls, cover)
	}
	
	return urls
}

// ExtractFromChatData extracts file URLs from chat message data
func (e *FileURLExtractor) ExtractFromChatData(data map[string]interface{}) []string {
	var urls []string
	
	// Extract attachments
	if attachments, ok := data["attachments"].([]interface{}); ok {
		for _, attachment := range attachments {
			if attData, ok := attachment.(map[string]interface{}); ok {
				if url, ok := attData["url"].(string); ok && url != "" {
					urls = append(urls, url)
				}
			}
		}
	}
	
	// Extract media files
	if media, ok := data["media"].([]interface{}); ok {
		for _, mediaItem := range media {
			if mediaURL, ok := mediaItem.(string); ok && mediaURL != "" {
				urls = append(urls, mediaURL)
			}
		}
	}
	
	return urls
}

// ValidationHelper provides validation utilities for file tracking
type ValidationHelper struct{}

// NewValidationHelper creates a new validation helper
func NewValidationHelper() *ValidationHelper {
	return &ValidationHelper{}
}

// ValidateFileURL validates if a URL is a valid file URL
func (v *ValidationHelper) ValidateFileURL(url string) bool {
	if url == "" {
		return false
	}
	
	// Check if it's a valid HTTP/HTTPS URL
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		return false
	}
	
	// Check if it contains file extension
	ext := filepath.Ext(url)
	return ext != ""
}

// ValidateEntityType validates entity type
func (v *ValidationHelper) ValidateEntityType(entityType string) bool {
	validTypes := []string{
		"product",
		"user",
		"chat_message",
		"inventory_item",
		"category",
		"order",
	}
	
	for _, validType := range validTypes {
		if entityType == validType {
			return true
		}
	}
	
	return false
}

// ValidateReferenceType validates reference type
func (v *ValidationHelper) ValidateReferenceType(refType string) bool {
	validTypes := []string{
		"primary",
		"secondary",
		"thumbnail",
		"attachment",
		"avatar",
		"cover",
	}
	
	for _, validType := range validTypes {
		if refType == validType {
			return true
		}
	}
	
	return false
}

// containsTag checks if a slice of tags contains a specific tag
func (h *FileTrackingHelper) containsTag(tags []string, target string) bool {
	for _, tag := range tags {
		if tag == target {
			return true
		}
	}
	return false
}