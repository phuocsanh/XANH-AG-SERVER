package file_tracking

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// FileTrackingMiddleware provides middleware for automatic file tracking
type FileTrackingMiddleware struct {
	helper    *FileTrackingHelper
	extractor *FileURLExtractor
	validator *ValidationHelper
}

// NewFileTrackingMiddleware creates a new file tracking middleware
func NewFileTrackingMiddleware(
	helper *FileTrackingHelper,
	extractor *FileURLExtractor,
	validator *ValidationHelper,
) *FileTrackingMiddleware {
	return &FileTrackingMiddleware{
		helper:    helper,
		extractor: extractor,
		validator: validator,
	}
}

// TrackFileChanges middleware automatically tracks file changes in requests
func (m *FileTrackingMiddleware) TrackFileChanges() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Store original request body for comparison
		originalBody := m.captureRequestBody(c)
		
		// Continue with the request
		c.Next()
		
		// Only process successful requests
		if c.Writer.Status() >= 200 && c.Writer.Status() < 300 {
			m.processFileChanges(c, originalBody)
		}
	}
}

// captureRequestBody captures and stores the request body
func (m *FileTrackingMiddleware) captureRequestBody(c *gin.Context) map[string]interface{} {
	var body map[string]interface{}
	
	// Try to bind JSON body
	if err := c.ShouldBindJSON(&body); err != nil {
		// If JSON binding fails, try form data
		body = make(map[string]interface{})
		for key, values := range c.Request.PostForm {
			if len(values) > 0 {
				body[key] = values[0]
			}
		}
	}
	
	return body
}

// processFileChanges processes file changes based on the request
func (m *FileTrackingMiddleware) processFileChanges(c *gin.Context, requestBody map[string]interface{}) {
	ctx := c.Request.Context()
	method := c.Request.Method
	
	// Extract entity information from path and body
	entityInfo := m.extractEntityInfo(c, requestBody)
	if entityInfo == nil {
		return
	}
	
	// Get user ID from context
	userID := m.getUserIDFromContext(c)
	
	switch method {
	case "POST":
		m.handleCreate(ctx, entityInfo, requestBody, userID)
	case "PUT", "PATCH":
		m.handleUpdate(ctx, entityInfo, requestBody, userID)
	case "DELETE":
		m.handleDelete(ctx, entityInfo, userID)
	}
}

// EntityInfo contains information about the entity being processed
type EntityInfo struct {
	Type string
	ID   int32
	Path string
}

// extractEntityInfo extracts entity information from request
func (m *FileTrackingMiddleware) extractEntityInfo(c *gin.Context, body map[string]interface{}) *EntityInfo {
	path := c.FullPath()
	
	// Parse entity type and ID from path
	if strings.Contains(path, "/products") {
		return m.extractProductInfo(c, body)
	} else if strings.Contains(path, "/users") {
		return m.extractUserInfo(c, body)
	} else if strings.Contains(path, "/chat") {
		return m.extractChatInfo(c, body)
	} else if strings.Contains(path, "/inventory") {
		return m.extractInventoryInfo(c, body)
	}
	
	return nil
}

// extractProductInfo extracts product entity information
func (m *FileTrackingMiddleware) extractProductInfo(c *gin.Context, body map[string]interface{}) *EntityInfo {
	// Try to get product ID from URL parameter
	if idStr := c.Param("id"); idStr != "" {
		if id, err := strconv.ParseInt(idStr, 10, 32); err == nil {
			return &EntityInfo{
				Type: "product",
				ID:   int32(id),
				Path: c.FullPath(),
			}
		}
	}
	
	// Try to get product ID from request body
	if idVal, ok := body["id"]; ok {
		if id, err := m.convertToInt32(idVal); err == nil {
			return &EntityInfo{
				Type: "product",
				ID:   id,
				Path: c.FullPath(),
			}
		}
	}
	
	return nil
}

// extractUserInfo extracts user entity information
func (m *FileTrackingMiddleware) extractUserInfo(c *gin.Context, body map[string]interface{}) *EntityInfo {
	if idStr := c.Param("id"); idStr != "" {
		if id, err := strconv.ParseInt(idStr, 10, 32); err == nil {
			return &EntityInfo{
				Type: "user",
				ID:   int32(id),
				Path: c.FullPath(),
			}
		}
	}
	
	if idVal, ok := body["user_id"]; ok {
		if id, err := m.convertToInt32(idVal); err == nil {
			return &EntityInfo{
				Type: "user",
				ID:   id,
				Path: c.FullPath(),
			}
		}
	}
	
	return nil
}

// extractChatInfo extracts chat entity information
func (m *FileTrackingMiddleware) extractChatInfo(c *gin.Context, body map[string]interface{}) *EntityInfo {
	if idStr := c.Param("messageId"); idStr != "" {
		if id, err := strconv.ParseInt(idStr, 10, 32); err == nil {
			return &EntityInfo{
				Type: "chat_message",
				ID:   int32(id),
				Path: c.FullPath(),
			}
		}
	}
	
	if idVal, ok := body["message_id"]; ok {
		if id, err := m.convertToInt32(idVal); err == nil {
			return &EntityInfo{
				Type: "chat_message",
				ID:   id,
				Path: c.FullPath(),
			}
		}
	}
	
	return nil
}

// extractInventoryInfo extracts inventory entity information
func (m *FileTrackingMiddleware) extractInventoryInfo(c *gin.Context, body map[string]interface{}) *EntityInfo {
	if idStr := c.Param("id"); idStr != "" {
		if id, err := strconv.ParseInt(idStr, 10, 32); err == nil {
			return &EntityInfo{
				Type: "inventory_item",
				ID:   int32(id),
				Path: c.FullPath(),
			}
		}
	}
	
	return nil
}

// handleCreate handles file tracking for create operations
func (m *FileTrackingMiddleware) handleCreate(ctx context.Context, entity *EntityInfo, body map[string]interface{}, userID *int32) {
	// Extract file URLs from request body
	var fileURLs []string
	
	switch entity.Type {
	case "product":
		fileURLs = m.extractor.ExtractFromProductData(body)
	case "user":
		fileURLs = m.extractor.ExtractFromUserData(body)
	case "chat_message":
		fileURLs = m.extractor.ExtractFromChatData(body)
	}
	
	// Add file references for each URL
	for _, url := range fileURLs {
		if !m.validator.ValidateFileURL(url) {
			continue
		}
		
		// Get file by URL
		helper := m.helper
		publicID := helper.extractPublicIDFromURL(url)
		if publicID == "" {
			continue
		}
		
		// Try to get existing file
		file, err := helper.fileService.GetFileUploadByPublicID(ctx, publicID)
		if err != nil {
			// File not tracked yet, skip for now
			// In a real implementation, you might want to create the file record
			continue
		}
		
		// Add reference
		fieldName := m.getFieldNameForURL(body, url)
		err = helper.fileService.AddFileReference(ctx, AddFileReferenceParams{
				FileID:           file.ID,
				EntityType:       entity.Type,
				EntityID:         entity.ID,
				FieldName:        fieldName,
				ReferenceType:    "primary",
				CreatedByUserID:  userID,
			})
		if err != nil {
			log.Printf("Failed to add file reference: %v", err)
		}
	}
}

// handleUpdate handles file tracking for update operations
func (m *FileTrackingMiddleware) handleUpdate(ctx context.Context, entity *EntityInfo, body map[string]interface{}, userID *int32) {
	// Get current file references
	currentRefs, err := m.helper.GetEntityFiles(ctx, entity.Type, entity.ID)
	if err != nil {
		log.Printf("Failed to get current file references: %v", err)
		return
	}
	
	// Extract current URLs
	var currentURLs []string
	for _, ref := range currentRefs {
		currentURLs = append(currentURLs, ref.FileUrl)
	}
	
	// Extract new URLs from request body
	var newURLs []string
	switch entity.Type {
	case "product":
		newURLs = m.extractor.ExtractFromProductData(body)
	case "user":
		newURLs = m.extractor.ExtractFromUserData(body)
	case "chat_message":
		newURLs = m.extractor.ExtractFromChatData(body)
	}
	
	// Update file references
	err = m.helper.UpdateEntityFileReferences(ctx, entity.Type, entity.ID, "files", currentURLs, newURLs, userID)
	if err != nil {
		log.Printf("Failed to update file references: %v", err)
	}
}

// handleDelete handles file tracking for delete operations
func (m *FileTrackingMiddleware) handleDelete(ctx context.Context, entity *EntityInfo, userID *int32) {
	// Remove all file references for the entity
	err := m.helper.RemoveEntityFileReferences(ctx, entity.Type, entity.ID, userID)
	if err != nil {
		log.Printf("Failed to remove file references: %v", err)
	}
}

// getUserIDFromContext extracts user ID from Gin context
func (m *FileTrackingMiddleware) getUserIDFromContext(c *gin.Context) *int32 {
	// Try to get user ID from various possible context keys
	if userID, exists := c.Get("user_id"); exists {
		if id, err := m.convertToInt32(userID); err == nil {
			return &id
		}
	}
	
	if userID, exists := c.Get("userId"); exists {
		if id, err := m.convertToInt32(userID); err == nil {
			return &id
		}
	}
	
	if userID, exists := c.Get("currentUser"); exists {
		// Handle user object
		if userMap, ok := userID.(map[string]interface{}); ok {
			if id, ok := userMap["id"]; ok {
				if convertedID, err := m.convertToInt32(id); err == nil {
					return &convertedID
				}
			}
		}
	}
	
	return nil
}

// getFieldNameForURL determines the field name for a given URL
func (m *FileTrackingMiddleware) getFieldNameForURL(body map[string]interface{}, url string) *string {
	// Check common field names
	fieldNames := []string{
		"product_thumb", "product_pictures", "product_videos",
		"avatar", "cover_image",
		"attachments", "media",
		"images", "files",
	}
	
	for _, fieldName := range fieldNames {
		if m.urlExistsInField(body, fieldName, url) {
			return &fieldName
		}
	}
	
	// Default field name
	defaultField := "files"
	return &defaultField
}

// urlExistsInField checks if a URL exists in a specific field
func (m *FileTrackingMiddleware) urlExistsInField(body map[string]interface{}, fieldName, url string) bool {
	field, exists := body[fieldName]
	if !exists {
		return false
	}
	
	// Handle string field
	if fieldStr, ok := field.(string); ok {
		return fieldStr == url
	}
	
	// Handle array field
	if fieldArray, ok := field.([]interface{}); ok {
		for _, item := range fieldArray {
			if itemStr, ok := item.(string); ok && itemStr == url {
				return true
			}
		}
	}
	
	return false
}

// convertToInt32 converts various types to int32
func (m *FileTrackingMiddleware) convertToInt32(value interface{}) (int32, error) {
	switch v := value.(type) {
	case int:
		return int32(v), nil
	case int32:
		return v, nil
	case int64:
		return int32(v), nil
	case float64:
		return int32(v), nil
	case string:
		if i, err := strconv.ParseInt(v, 10, 32); err == nil {
			return int32(i), nil
		}
		return 0, fmt.Errorf("cannot convert string to int32: %s", v)
	default:
		return 0, fmt.Errorf("cannot convert %T to int32", value)
	}
}

// FileUploadMiddleware handles file upload tracking
type FileUploadMiddleware struct {
	helper *FileTrackingHelper
}

// NewFileUploadMiddleware creates a new file upload middleware
func NewFileUploadMiddleware(helper *FileTrackingHelper) *FileUploadMiddleware {
	return &FileUploadMiddleware{
		helper: helper,
	}
}

// TrackUpload middleware for tracking file uploads
func (m *FileUploadMiddleware) TrackUpload() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Continue with the upload
		c.Next()
		
		// Only process successful uploads
		if c.Writer.Status() >= 200 && c.Writer.Status() < 300 {
			m.processUpload(c)
		}
	}
}

// processUpload processes the upload response and tracks the file
func (m *FileUploadMiddleware) processUpload(c *gin.Context) {
	ctx := c.Request.Context()
	
	// Try to get upload response from context or response body
	uploadResponse := m.getUploadResponse(c)
	if uploadResponse == nil {
		return
	}
	
	// Extract file information
	publicID, ok := uploadResponse["public_id"].(string)
	if !ok {
		return
	}
	
	fileURL, ok := uploadResponse["secure_url"].(string)
	if !ok {
		fileURL, _ = uploadResponse["url"].(string)
	}
	
	// Use correct field names from upload handler
	fileName, _ := uploadResponse["file_name"].(string)
	fileType, _ := uploadResponse["resource_type"].(string)
	fileSize, _ := uploadResponse["file_size"].(int64)
	folder, _ := uploadResponse["folder"].(string)
	
	// Get user ID
	userID := m.getUserIDFromContext(c)
	
	// Create file upload record
	_, err := m.helper.fileService.CreateFileUpload(ctx, CreateFileUploadParams{
		PublicID:          publicID,
		FileURL:           fileURL,
		FileName:          fileName,
		FileType:          fileType,
		FileSize:          fileSize,
		Folder:            &folder,
		UploadedByUserID:  userID,
		Metadata:          uploadResponse,
	})
	if err != nil {
		log.Printf("Failed to track uploaded file: %v", err)
	}
}

// getUploadResponse extracts upload response from context or response
func (m *FileUploadMiddleware) getUploadResponse(c *gin.Context) map[string]interface{} {
	// Try to get from context first
	if response, exists := c.Get("upload_response"); exists {
		if responseMap, ok := response.(map[string]interface{}); ok {
			return responseMap
		}
	}
	
	// Try to parse from response body (if available)
	// This would require capturing the response body, which is more complex
	// For now, we'll rely on the upload service setting the response in context
	
	return nil
}

// getUserIDFromContext extracts user ID from context
func (m *FileUploadMiddleware) getUserIDFromContext(c *gin.Context) *int32 {
	if userID, exists := c.Get("user_id"); exists {
		if id, err := m.convertToInt32(userID); err == nil {
			return &id
		}
	}
	return nil
}

// convertToInt32 converts various types to int32
func (m *FileUploadMiddleware) convertToInt32(value interface{}) (int32, error) {
	v := reflect.ValueOf(value)
	switch v.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return int32(v.Int()), nil
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return int32(v.Uint()), nil
	case reflect.Float32, reflect.Float64:
		return int32(v.Float()), nil
	case reflect.String:
		if i, err := strconv.ParseInt(v.String(), 10, 32); err == nil {
			return int32(i), nil
		}
		return 0, fmt.Errorf("cannot convert string to int32: %s", v.String())
	default:
		return 0, fmt.Errorf("cannot convert %T to int32", value)
	}
}

// CleanupMiddleware provides middleware for cleanup operations
type CleanupMiddleware struct {
	helper *FileTrackingHelper
}

// NewCleanupMiddleware creates a new cleanup middleware
func NewCleanupMiddleware(helper *FileTrackingHelper) *CleanupMiddleware {
	return &CleanupMiddleware{
		helper: helper,
	}
}

// RequireCleanupAuth middleware to protect cleanup endpoints
func (m *CleanupMiddleware) RequireCleanupAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check for admin privileges or API key
		apiKey := c.GetHeader("X-Cleanup-API-Key")
		if apiKey == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Cleanup API key required"})
			c.Abort()
			return
		}
		
		// Validate API key (implement your own validation logic)
		if !m.validateCleanupAPIKey(apiKey) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Invalid cleanup API key"})
			c.Abort()
			return
		}
		
		c.Next()
	}
}

// validateCleanupAPIKey validates the cleanup API key
func (m *CleanupMiddleware) validateCleanupAPIKey(apiKey string) bool {
	// Implement your own API key validation logic
	// This could check against environment variables, database, etc.
	validKeys := []string{
		"cleanup-api-key-123", // Example key
	}
	
	for _, validKey := range validKeys {
		if apiKey == validKey {
			return true
		}
	}
	
	return false
}

// LogCleanupOperation middleware to log cleanup operations
func (m *CleanupMiddleware) LogCleanupOperation() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.FullPath()
		method := c.Request.Method
		
		log.Printf("Starting cleanup operation: %s %s", method, path)
		
		c.Next()
		
		duration := time.Since(start)
		status := c.Writer.Status()
		
		log.Printf("Completed cleanup operation: %s %s - Status: %d, Duration: %v", 
			method, path, status, duration)
	}
}