package file_tracking

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gn-farm-go-server/internal/database"
)

// FileTrackingHandler handles HTTP requests for file tracking
type FileTrackingHandler struct {
	fileService FileTrackingService
	helper      *FileTrackingHelper
}

// NewFileTrackingHandler creates a new file tracking handler
func NewFileTrackingHandler(
	fileService FileTrackingService,
	helper *FileTrackingHelper,
) *FileTrackingHandler {
	return &FileTrackingHandler{
		fileService: fileService,
		helper:      helper,
	}
}

// GetFileStatistics returns file usage statistics
// GET /api/admin/files/statistics
func (h *FileTrackingHandler) GetFileStatistics(c *gin.Context) {
	ctx := c.Request.Context()
	
	stats, err := h.fileService.GetFileStatistics(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get file statistics",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": stats,
	})
}

// CleanupTemporaryFiles performs cleanup of temporary files
// POST /api/admin/files/cleanup/temporary
func (h *FileTrackingHandler) CleanupTemporaryFiles(c *gin.Context) {
	ctx := c.Request.Context()
	
	// Parse max age from query parameter (default: 24 hours)
	maxAgeStr := c.DefaultQuery("max_age", "24h")
	maxAge, err := time.ParseDuration(maxAgeStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid max_age parameter",
			"details": "Use format like '24h', '7d', '30m'",
		})
		return
	}
	
	// Parse dry run flag
	dryRun := c.DefaultQuery("dry_run", "false") == "true"
	
	if dryRun {
		// For dry run, just return what would be cleaned up
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Dry run mode - no files were actually deleted",
			"max_age": maxAge.String(),
		})
		return
	}
	
	// Perform actual cleanup
	result, err := h.fileService.CleanupTemporaryFiles(ctx, maxAge)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to cleanup temporary files",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": result,
		"message": "Temporary files cleanup completed",
	})
}

// CleanupOrphanedFiles performs cleanup of orphaned files
// POST /api/admin/files/cleanup/orphaned
func (h *FileTrackingHandler) CleanupOrphanedFiles(c *gin.Context) {
	ctx := c.Request.Context()
	
	// Parse grace period from query parameter (default: 7 days)
	gracePeriodStr := c.DefaultQuery("grace_period", "168h") // 7 days
	gracePeriod, err := time.ParseDuration(gracePeriodStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid grace_period parameter",
			"details": "Use format like '24h', '7d', '30m'",
		})
		return
	}
	
	// Parse dry run flag
	dryRun := c.DefaultQuery("dry_run", "false") == "true"
	
	if dryRun {
		// For dry run, just return what would be cleaned up
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Dry run mode - no files were actually deleted",
			"grace_period": gracePeriod.String(),
		})
		return
	}
	
	// Perform actual cleanup
	result, err := h.fileService.CleanupOrphanedFiles(ctx, gracePeriod)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to cleanup orphaned files",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": result,
		"message": "Orphaned files cleanup completed",
	})
}

// MarkOrphanedFiles marks files as orphaned
// POST /api/admin/files/mark-orphaned
func (h *FileTrackingHandler) MarkOrphanedFiles(c *gin.Context) {
	ctx := c.Request.Context()
	
	count, err := h.fileService.MarkOrphanedFiles(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to mark orphaned files",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"orphaned_count": count,
		},
		"message": "Files marked as orphaned",
	})
}

// GetFileInfo returns information about a specific file
// GET /api/admin/files/:publicId
func (h *FileTrackingHandler) GetFileInfo(c *gin.Context) {
	ctx := c.Request.Context()
	publicID := c.Param("publicId")
	
	if publicID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Public ID is required",
		})
		return
	}
	
	file, err := h.fileService.GetFileUploadByPublicID(ctx, publicID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "File not found",
			"details": err.Error(),
		})
		return
	}
	
	// Get file references
	references, err := h.fileService.GetFileReferences(ctx, "file", file.ID)
	if err != nil {
		references = []database.GetFileReferencesRow{} // Empty if error
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"file": file,
			"references": references,
		},
	})
}

// GetAuditLogs returns audit logs for file operations
// GET /api/admin/files/audit-logs
func (h *FileTrackingHandler) GetAuditLogs(c *gin.Context) {
	ctx := c.Request.Context()
	
	// Parse query parameters
	var fileID *int32
	if fileIDStr := c.Query("file_id"); fileIDStr != "" {
		if id, err := strconv.ParseInt(fileIDStr, 10, 32); err == nil {
			fileID32 := int32(id)
			fileID = &fileID32
		}
	}
	
	var action *string
	if actionStr := c.Query("action"); actionStr != "" {
		action = &actionStr
	}
	
	var userID *int32
	if userIDStr := c.Query("user_id"); userIDStr != "" {
		if id, err := strconv.ParseInt(userIDStr, 10, 32); err == nil {
			userID32 := int32(id)
			userID = &userID32
		}
	}
	
	// Parse time range
	var startTime, endTime time.Time
	if startStr := c.Query("start_time"); startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			startTime = t
		}
	}
	if endStr := c.Query("end_time"); endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			endTime = t
		}
	}
	
	// Parse pagination
	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "50"), 10, 32)
	offset, _ := strconv.ParseInt(c.DefaultQuery("offset", "0"), 10, 32)
	
	logs, err := h.fileService.GetAuditLogs(ctx, GetAuditLogsParams{
		FileID:            fileID,
		Action:            action,
		PerformedByUserID: userID,
		StartTime:         startTime,
		EndTime:           endTime,
		Limit:             int32(limit),
		Offset:            int32(offset),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get audit logs",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": logs,
		"pagination": gin.H{
			"limit": limit,
			"offset": offset,
			"count": len(logs),
		},
	})
}

// DeleteFile manually deletes a file
// DELETE /api/admin/files/:id
func (h *FileTrackingHandler) DeleteFile(c *gin.Context) {
	ctx := c.Request.Context()
	idStr := c.Param("id")
	
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid file ID",
		})
		return
	}
	
	err = h.fileService.DeleteFileUpload(ctx, int32(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete file",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "File deleted successfully",
	})
}

// BatchDeleteFiles deletes multiple files
// POST /api/admin/files/batch-delete
func (h *FileTrackingHandler) BatchDeleteFiles(c *gin.Context) {
	ctx := c.Request.Context()
	
	var request struct {
		FileIDs []int32 `json:"file_ids" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
			"details": err.Error(),
		})
		return
	}
	
	result, err := h.fileService.BatchCleanupFiles(ctx, request.FileIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to batch delete files",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": result,
		"message": "Batch delete completed",
	})
}

// AddFileReference manually adds a file reference
// POST /api/admin/files/:id/references
func (h *FileTrackingHandler) AddFileReference(c *gin.Context) {
	ctx := c.Request.Context()
	idStr := c.Param("id")
	
	fileID, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid file ID",
		})
		return
	}
	
	var request struct {
		EntityType      string  `json:"entity_type" binding:"required"`
		EntityID        int32   `json:"entity_id" binding:"required"`
		FieldName       *string `json:"field_name"`
		ReferenceType   string  `json:"reference_type"`
		CreatedByUserID *int32  `json:"created_by_user_id"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
			"details": err.Error(),
		})
		return
	}
	
	// Set default reference type if not provided
	if request.ReferenceType == "" {
		request.ReferenceType = ReferenceTypePrimary
	}
	
	err = h.fileService.AddFileReference(ctx, AddFileReferenceParams{
		FileID:           int32(fileID),
		EntityType:       request.EntityType,
		EntityID:         request.EntityID,
		FieldName:        request.FieldName,
		ReferenceType:    request.ReferenceType,
		CreatedByUserID:  request.CreatedByUserID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to add file reference",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "File reference added successfully",
	})
}

// RemoveFileReference manually removes a file reference
// DELETE /api/admin/files/:id/references
func (h *FileTrackingHandler) RemoveFileReference(c *gin.Context) {
	ctx := c.Request.Context()
	idStr := c.Param("id")
	
	fileID, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid file ID",
		})
		return
	}
	
	var request struct {
		EntityType       string  `json:"entity_type" binding:"required"`
		EntityID         int32   `json:"entity_id" binding:"required"`
		DeletedByUserID  *int32  `json:"deleted_by_user_id"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
			"details": err.Error(),
		})
		return
	}
	
	err = h.fileService.RemoveFileReference(ctx, RemoveFileReferenceParams{
		FileID:           int32(fileID),
		EntityType:       request.EntityType,
		EntityID:         request.EntityID,
		DeletedByUserID:  request.DeletedByUserID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to remove file reference",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "File reference removed successfully",
	})
}

// ScheduleCleanupJob schedules a cleanup job
// POST /api/admin/files/cleanup/schedule
func (h *FileTrackingHandler) ScheduleCleanupJob(c *gin.Context) {
	ctx := c.Request.Context()
	
	var request struct {
		JobType    string                 `json:"job_type" binding:"required"`
		Parameters map[string]interface{} `json:"parameters"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
			"details": err.Error(),
		})
		return
	}
	
	// Validate job type
	validJobTypes := []string{
		CleanupJobTemporary,
		CleanupJobOrphaned,
		CleanupJobManual,
	}
	
	validJobType := false
	for _, validType := range validJobTypes {
		if request.JobType == validType {
			validJobType = true
			break
		}
	}
	
	if !validJobType {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid job type",
			"valid_types": validJobTypes,
		})
		return
	}
	
	job, err := h.fileService.ScheduleCleanupJob(ctx, request.JobType, request.Parameters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to schedule cleanup job",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": job,
		"message": "Cleanup job scheduled successfully",
	})
}

// GetHealthCheck returns health status of file tracking system
// GET /api/admin/files/health
func (h *FileTrackingHandler) GetHealthCheck(c *gin.Context) {
	ctx := c.Request.Context()
	
	// Get basic statistics to verify system health
	stats, err := h.fileService.GetFileStatistics(ctx)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"healthy": false,
			"error": "Failed to get file statistics",
			"details": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"healthy": true,
		"timestamp": time.Now(),
		"statistics": stats,
		"message": "File tracking system is healthy",
	})
}