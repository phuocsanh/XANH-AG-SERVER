package file_tracking

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service/upload"
	"github.com/sqlc-dev/pqtype"
)

type fileTrackingService struct {
	db             *database.Queries
	eventPublisher EventPublisher
	uploadService  upload.UploadService
}

// SetUploadService cập nhật upload service
func (s *fileTrackingService) SetUploadService(service upload.UploadService) {
	s.uploadService = service
}

// EventPublisher interface for publishing file events to message queue
type EventPublisher interface {
	PublishFileEvent(ctx context.Context, event FileEvent) error
}

// NewFileTrackingService creates a new file tracking service
func NewFileTrackingService(
	db *database.Queries,
	eventPublisher EventPublisher,
	uploadService upload.UploadService,
) FileTrackingService {
	return &fileTrackingService{
		db:             db,
		eventPublisher: eventPublisher,
		uploadService:  uploadService,
	}
}

// CreateFileUpload tạo record file upload mới
func (s *fileTrackingService) CreateFileUpload(ctx context.Context, params CreateFileUploadParams) (*database.FileUpload, error) {
	log.Printf("[FILE_TRACKING] Creating file upload - PublicID: %s, FileName: %s, FileSize: %d", params.PublicID, params.FileName, params.FileSize)
	
	// Convert metadata to JSONB
	metadataJSON, err := json.Marshal(params.Metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Create file upload record
	var folder sql.NullString
	if params.Folder != nil {
		folder = sql.NullString{String: *params.Folder, Valid: true}
	}

	var mimeType sql.NullString
	if params.MimeType != nil {
		mimeType = sql.NullString{String: *params.MimeType, Valid: true}
	}

	var uploadedByUserID sql.NullInt32
	if params.UploadedByUserID != nil {
		uploadedByUserID = sql.NullInt32{Int32: *params.UploadedByUserID, Valid: true}
	}

	var isTemporary sql.NullBool
	if params.IsTemporary != nil {
		isTemporary = sql.NullBool{Bool: *params.IsTemporary, Valid: true}
	}

	fileUpload, err := s.db.CreateFileUpload(ctx, database.CreateFileUploadParams{
		PublicID:         params.PublicID,
		FileUrl:          params.FileURL,
		FileName:         params.FileName,
		FileType:         params.FileType,
		FileSize:         params.FileSize,
		Folder:           folder,
		MimeType:         mimeType,
		UploadedByUserID: uploadedByUserID,
		Tags:             params.Tags,
		Metadata:         pqtype.NullRawMessage{RawMessage: metadataJSON, Valid: len(metadataJSON) > 0},
		IsTemporary:      isTemporary,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create file upload: %w", err)
	}

	// Log audit
	err = s.LogFileAction(ctx, LogFileActionParams{
		FileID:            &fileUpload.ID,
		Action:            ActionUpload,
		PerformedByUserID: params.UploadedByUserID,
		Details: map[string]interface{}{
			"file_name": params.FileName,
			"file_size": params.FileSize,
			"file_type": params.FileType,
		},
	})
	if err != nil {
		log.Printf("Failed to log file upload action: %v", err)
	}

	// Publish event
	if s.eventPublisher != nil {
		event := FileEvent{
			Type:      FileEventUpload,
			FileID:    fileUpload.ID,
			PublicID:  fileUpload.PublicID,
			Action:    ActionUpload,
			UserID:    params.UploadedByUserID,
			Timestamp: time.Now(),
			Metadata: map[string]interface{}{
				"file_name": params.FileName,
				"file_size": params.FileSize,
				"file_type": params.FileType,
			},
		}
		if err := s.eventPublisher.PublishFileEvent(ctx, event); err != nil {
			log.Printf("Failed to publish file upload event: %v", err)
		}
	}

	log.Printf("[FILE_TRACKING] File upload created successfully - ID: %d, PublicID: %s, CreatedAt: %v", fileUpload.ID, fileUpload.PublicID, fileUpload.CreatedAt)
	return &fileUpload, nil
}

// GetFileUploadByPublicID lấy file upload theo public ID
func (s *fileTrackingService) GetFileUploadByPublicID(ctx context.Context, publicID string) (*database.FileUpload, error) {
	fileUpload, err := s.db.GetFileUploadByPublicID(ctx, publicID)
	if err != nil {
		return nil, fmt.Errorf("failed to get file upload by public ID: %w", err)
	}
	return &fileUpload, nil
}

// GetFileUploadByID lấy file upload theo ID
func (s *fileTrackingService) GetFileUploadByID(ctx context.Context, id int32) (*database.FileUpload, error) {
	fileUpload, err := s.db.GetFileUploadByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get file upload by ID: %w", err)
	}
	return &fileUpload, nil
}

// AddFileReference thêm reference mới cho file
func (s *fileTrackingService) AddFileReference(ctx context.Context, params AddFileReferenceParams) error {
	// Create file reference
	var fieldName sql.NullString
	if params.FieldName != nil {
		fieldName = sql.NullString{String: *params.FieldName, Valid: true}
	}

	var createdByUserID sql.NullInt32
	if params.CreatedByUserID != nil {
		createdByUserID = sql.NullInt32{Int32: *params.CreatedByUserID, Valid: true}
	}

	_, err := s.db.CreateFileReference(ctx, database.CreateFileReferenceParams{
		FileID:           params.FileID,
		EntityType:       params.EntityType,
		EntityID:         params.EntityID,
		FieldName:        fieldName,
		ReferenceType:    sql.NullString{String: params.ReferenceType, Valid: true},
		CreatedByUserID:  createdByUserID,
	})
	if err != nil {
		return fmt.Errorf("failed to create file reference: %w", err)
	}

	// Publish event
	if s.eventPublisher != nil {
		event := FileEvent{
			Type:       FileEventReferenceAdd,
			FileID:     params.FileID,
			Action:     ActionReferenceAdd,
			EntityType: &params.EntityType,
			EntityID:   &params.EntityID,
			UserID:     params.CreatedByUserID,
			Timestamp:  time.Now(),
		}
		if err := s.eventPublisher.PublishFileEvent(ctx, event); err != nil {
			log.Printf("Failed to publish file reference add event: %v", err)
		}
	}

	return nil
}

// RemoveFileReference xóa reference của file
func (s *fileTrackingService) RemoveFileReference(ctx context.Context, params RemoveFileReferenceParams) error {
	var deletedByUserID sql.NullInt32
	if params.DeletedByUserID != nil {
		deletedByUserID = sql.NullInt32{Int32: *params.DeletedByUserID, Valid: true}
	}

	err := s.db.DeleteFileReference(ctx, database.DeleteFileReferenceParams{
		FileID:           params.FileID,
		EntityType:       params.EntityType,
		EntityID:         params.EntityID,
		DeletedByUserID:  deletedByUserID,
	})
	if err != nil {
		return fmt.Errorf("failed to delete file reference: %w", err)
	}

	// Publish event
	if s.eventPublisher != nil {
		event := FileEvent{
			Type:       FileEventReferenceRemove,
			FileID:     params.FileID,
			Action:     ActionReferenceRemove,
			EntityType: &params.EntityType,
			EntityID:   &params.EntityID,
			UserID:     params.DeletedByUserID,
			Timestamp:  time.Now(),
		}
		if err := s.eventPublisher.PublishFileEvent(ctx, event); err != nil {
			log.Printf("Failed to publish file reference remove event: %v", err)
		}
	}

	return nil
}

// GetFileReferences lấy danh sách references của entity
func (s *fileTrackingService) GetFileReferences(ctx context.Context, entityType string, entityID int32) ([]database.GetFileReferencesRow, error) {
	references, err := s.db.GetFileReferences(ctx, database.GetFileReferencesParams{
		EntityType: entityType,
		EntityID:   entityID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get file references: %w", err)
	}
	return references, nil
}

// UpdateReferenceCount cập nhật reference count cho file
func (s *fileTrackingService) UpdateReferenceCount(ctx context.Context, fileID int32) error {
	// Count active references
	count, err := s.db.CountActiveReferences(ctx, fileID)
	if err != nil {
		return fmt.Errorf("failed to count active references: %w", err)
	}

	// Update file status based on reference count
	isOrphaned := count == 0
	isTemporary := false // File with references is not temporary

	err = s.db.UpdateFileUploadStatus(ctx, database.UpdateFileUploadStatusParams{
		ID:          fileID,
		IsTemporary: sql.NullBool{Bool: isTemporary, Valid: true},
		IsOrphaned:  sql.NullBool{Bool: isOrphaned, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to update file upload status: %w", err)
	}

	// Mark for deletion if orphaned
	if isOrphaned {
		err = s.db.MarkFileForDeletion(ctx, fileID)
		if err != nil {
			return fmt.Errorf("failed to mark file for deletion: %w", err)
		}

		// Publish orphaned event
		if s.eventPublisher != nil {
			event := FileEvent{
				Type:      FileEventOrphaned,
				FileID:    fileID,
				Action:    ActionMarkOrphaned,
				Timestamp: time.Now(),
			}
			if err := s.eventPublisher.PublishFileEvent(ctx, event); err != nil {
				log.Printf("Failed to publish file orphaned event: %v", err)
			}
		}
	}

	return nil
}

// MarkOrphanedFiles đánh dấu các file không có reference
func (s *fileTrackingService) MarkOrphanedFiles(ctx context.Context) (int, error) {
	// This would be implemented with a custom query to find files with zero references
	// For now, we'll return 0 as placeholder
	return 0, nil
}

// CleanupTemporaryFiles dọn dẹp các file tạm thời
func (s *fileTrackingService) CleanupTemporaryFiles(ctx context.Context, olderThan time.Duration) (*CleanupResult, error) {
	startTime := time.Now()
	log.Printf("[FILE_TRACKING] Starting CleanupTemporaryFiles - olderThan: %v, cutoffTime will be: %v", olderThan, time.Now().Add(-olderThan))
	
	// Create cleanup job
	jobParams := map[string]interface{}{
		"older_than": olderThan.String(),
		"job_type":   CleanupJobTemporary,
	}
	job, err := s.ScheduleCleanupJob(ctx, CleanupJobTemporary, jobParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create cleanup job: %w", err)
	}

	// Update job status to running
	err = s.db.UpdateCleanupJobStatus(ctx, database.UpdateCleanupJobStatusParams{
		ID:     job.ID,
		Status: sql.NullString{String: "running", Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update job status: %w", err)
	}

	// Get temporary files older than specified duration
	cutoffTime := time.Now().Add(-olderThan)
	log.Printf("[FILE_TRACKING] Querying temporary files older than: %v", cutoffTime)
	files, err := s.db.GetTemporaryFiles(ctx, database.GetTemporaryFilesParams{
		CreatedAt: sql.NullTime{Time: cutoffTime, Valid: true},
		Limit:     1000, // Process in batches
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get temporary files: %w", err)
	}
	log.Printf("[FILE_TRACKING] Found %d temporary files to process", len(files))

	result := &CleanupResult{
		JobID:          job.ID,
		FilesProcessed: int32(len(files)),
		StartTime:      startTime,
	}

	// Delete files from cloud storage and database
	for _, file := range files {
		// Delete from cloud storage
		if err := s.uploadService.DeleteFile(ctx, file.PublicID); err != nil {
			log.Printf("Failed to delete file from cloud storage: %v", err)
			result.FilesFailed++
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to delete %s: %v", file.PublicID, err))
			continue
		}

		// Delete from database
		if err := s.db.HardDeleteFileUpload(ctx, file.ID); err != nil {
			log.Printf("Failed to delete file from database: %v", err)
			result.FilesFailed++
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to delete DB record %d: %v", file.ID, err))
			continue
		}

		result.FilesDeleted++

		// Log audit
		s.LogFileAction(ctx, LogFileActionParams{
			FileID: &file.ID,
			Action: ActionCleanup,
			Details: map[string]interface{}{
				"cleanup_type": "temporary",
				"job_id":       job.ID,
			},
		})
	}

	result.EndTime = time.Now()
	result.Duration = result.EndTime.Sub(result.StartTime)

	// Update job status
	status := "completed"
	if result.FilesFailed > 0 {
		status = "failed"
	}

	err = s.db.UpdateCleanupJobStatus(ctx, database.UpdateCleanupJobStatusParams{
		ID:             job.ID,
		Status:         sql.NullString{String: status, Valid: true},
		FilesProcessed: sql.NullInt32{Int32: result.FilesProcessed, Valid: true},
		FilesDeleted:   sql.NullInt32{Int32: result.FilesDeleted, Valid: true},
		FilesFailed:    sql.NullInt32{Int32: result.FilesFailed, Valid: true},
	})
	if err != nil {
		log.Printf("Failed to update cleanup job status: %v", err)
	}

	log.Printf("[FILE_TRACKING] CleanupTemporaryFiles completed - JobID: %d, Processed: %d, Deleted: %d, Failed: %d, Duration: %v", 
		result.JobID, result.FilesProcessed, result.FilesDeleted, result.FilesFailed, result.Duration)
	return result, nil
}

// CleanupOrphanedFiles dọn dẹp các file mồ côi
func (s *fileTrackingService) CleanupOrphanedFiles(ctx context.Context, gracePeriod time.Duration) (*CleanupResult, error) {
	startTime := time.Now()
	
	// Create cleanup job
	jobParams := map[string]interface{}{
		"grace_period": gracePeriod.String(),
		"job_type":     CleanupJobOrphaned,
	}
	job, err := s.ScheduleCleanupJob(ctx, CleanupJobOrphaned, jobParams)
	if err != nil {
		return nil, fmt.Errorf("failed to create cleanup job: %w", err)
	}

	// Update job status to running
	err = s.db.UpdateCleanupJobStatus(ctx, database.UpdateCleanupJobStatusParams{
		ID:     job.ID,
		Status: sql.NullString{String: "running", Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update job status: %w", err)
	}

	// Get orphaned files older than grace period
	cutoffTime := time.Now().Add(-gracePeriod)
	files, err := s.db.GetOrphanedFiles(ctx, database.GetOrphanedFilesParams{
		MarkedForDeletionAt: sql.NullTime{Time: cutoffTime, Valid: true},
		Limit:               1000,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get orphaned files: %w", err)
	}

	result := &CleanupResult{
		JobID:          job.ID,
		FilesProcessed: int32(len(files)),
		StartTime:      startTime,
	}

	// Delete files
	for _, file := range files {
		// Delete from cloud storage
		if err := s.uploadService.DeleteFile(ctx, file.PublicID); err != nil {
			log.Printf("Failed to delete file from cloud storage: %v", err)
			result.FilesFailed++
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to delete %s: %v", file.PublicID, err))
			continue
		}

		// Mark as deleted in database
		if err := s.db.DeleteFileUpload(ctx, file.ID); err != nil {
			log.Printf("Failed to mark file as deleted: %v", err)
			result.FilesFailed++
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to mark as deleted %d: %v", file.ID, err))
			continue
		}

		result.FilesDeleted++

		// Log audit
		s.LogFileAction(ctx, LogFileActionParams{
			FileID: &file.ID,
			Action: ActionDelete,
			Details: map[string]interface{}{
				"cleanup_type": "orphaned",
				"job_id":       job.ID,
			},
		})

		// Publish event
		if s.eventPublisher != nil {
			event := FileEvent{
				Type:      FileEventDeleted,
				FileID:    file.ID,
				PublicID:  file.PublicID,
				Action:    ActionDelete,
				Timestamp: time.Now(),
				Metadata: map[string]interface{}{
					"cleanup_type": "orphaned",
					"job_id":       job.ID,
				},
			}
			if err := s.eventPublisher.PublishFileEvent(ctx, event); err != nil {
				log.Printf("Failed to publish file deleted event: %v", err)
			}
		}
	}

	result.EndTime = time.Now()
	result.Duration = result.EndTime.Sub(result.StartTime)

	// Update job status
	status := "completed"
	if result.FilesFailed > 0 {
		status = "failed"
	}

	err = s.db.UpdateCleanupJobStatus(ctx, database.UpdateCleanupJobStatusParams{
		ID:             job.ID,
		Status:         sql.NullString{String: status, Valid: true},
		FilesProcessed: sql.NullInt32{Int32: result.FilesProcessed, Valid: true},
		FilesDeleted:   sql.NullInt32{Int32: result.FilesDeleted, Valid: true},
		FilesFailed:    sql.NullInt32{Int32: result.FilesFailed, Valid: true},
	})
	if err != nil {
		log.Printf("Failed to update cleanup job status: %v", err)
	}

	return result, nil
}

// ScheduleCleanupJob tạo cleanup job mới
func (s *fileTrackingService) ScheduleCleanupJob(ctx context.Context, jobType string, params map[string]interface{}) (*database.FileCleanupJob, error) {
	paramsJSON, err := json.Marshal(params)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal job parameters: %w", err)
	}

	job, err := s.db.CreateCleanupJob(ctx, database.CreateCleanupJobParams{
		JobType:    jobType,
		Status:     sql.NullString{String: "pending", Valid: true},
		Parameters: pqtype.NullRawMessage{RawMessage: paramsJSON, Valid: len(paramsJSON) > 0},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create cleanup job: %w", err)
	}

	return &job, nil
}

// LogFileAction ghi log audit cho file action
func (s *fileTrackingService) LogFileAction(ctx context.Context, params LogFileActionParams) error {
	detailsJSON, err := json.Marshal(params.Details)
	if err != nil {
		return fmt.Errorf("failed to marshal details: %w", err)
	}

	var fileID sql.NullInt32
	if params.FileID != nil {
		fileID = sql.NullInt32{Int32: *params.FileID, Valid: true}
	}

	var entityType sql.NullString
	if params.EntityType != nil {
		entityType = sql.NullString{String: *params.EntityType, Valid: true}
	}

	var entityID sql.NullInt32
	if params.EntityID != nil {
		entityID = sql.NullInt32{Int32: *params.EntityID, Valid: true}
	}

	var oldReferenceCount sql.NullInt32
	if params.OldReferenceCount != nil {
		oldReferenceCount = sql.NullInt32{Int32: *params.OldReferenceCount, Valid: true}
	}

	var newReferenceCount sql.NullInt32
	if params.NewReferenceCount != nil {
		newReferenceCount = sql.NullInt32{Int32: *params.NewReferenceCount, Valid: true}
	}

	var performedByUserID sql.NullInt32
	if params.PerformedByUserID != nil {
		performedByUserID = sql.NullInt32{Int32: *params.PerformedByUserID, Valid: true}
	}

	var userAgent sql.NullString
	if params.UserAgent != nil {
		userAgent = sql.NullString{String: *params.UserAgent, Valid: true}
	}

	_, err = s.db.CreateFileAuditLog(ctx, database.CreateFileAuditLogParams{
		FileID:               fileID,
		Action:               params.Action,
		EntityType:           entityType,
		EntityID:             entityID,
		OldReferenceCount:    oldReferenceCount,
		NewReferenceCount:    newReferenceCount,
		Details:              pqtype.NullRawMessage{RawMessage: detailsJSON, Valid: len(detailsJSON) > 0},
		PerformedByUserID:    performedByUserID,
		IpAddress:            pqtype.Inet{Valid: false},
		UserAgent:            userAgent,
	})
	if err != nil {
		return fmt.Errorf("failed to create audit log: %w", err)
	}

	return nil
}

// GetFileStatistics lấy thống kê file
func (s *fileTrackingService) GetFileStatistics(ctx context.Context) (*database.GetFileStatisticsRow, error) {
	stats, err := s.db.GetFileStatistics(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get file statistics: %w", err)
	}
	return &stats, nil
}

// GetAuditLogs lấy audit logs
func (s *fileTrackingService) GetAuditLogs(ctx context.Context, params GetAuditLogsParams) ([]database.GetFileAuditLogsRow, error) {
	// Map parameters to database query parameters
	var column1 int32
	if params.FileID != nil {
		column1 = *params.FileID
	}
	
	var column2 string
	if params.Action != nil {
		column2 = *params.Action
	}
	
	var column3 int32
	if params.PerformedByUserID != nil {
		column3 = *params.PerformedByUserID
	}
	
	logs, err := s.db.GetFileAuditLogs(ctx, database.GetFileAuditLogsParams{
		Column1:       column1,
		Column2:       column2,
		Column3:       column3,
		PerformedAt:   sql.NullTime{Time: params.StartTime, Valid: !params.StartTime.IsZero()},
		PerformedAt_2: sql.NullTime{Time: params.EndTime, Valid: !params.EndTime.IsZero()},
		Limit:         params.Limit,
		Offset:        params.Offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get audit logs: %w", err)
	}
	return logs, nil
}

// DeleteFileUpload xóa file upload
func (s *fileTrackingService) DeleteFileUpload(ctx context.Context, id int32) error {
	// Get file info first
	file, err := s.GetFileUploadByID(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get file: %w", err)
	}

	// Delete from cloud storage
	if err := s.uploadService.DeleteFile(ctx, file.PublicID); err != nil {
		return fmt.Errorf("failed to delete from cloud storage: %w", err)
	}

	// Mark as deleted in database
	if err := s.db.DeleteFileUpload(ctx, id); err != nil {
		return fmt.Errorf("failed to mark file as deleted: %w", err)
	}

	// Log audit
	s.LogFileAction(ctx, LogFileActionParams{
		FileID: &id,
		Action: ActionDelete,
		Details: map[string]interface{}{
			"manual_delete": true,
		},
	})

	return nil
}

// Batch operations
func (s *fileTrackingService) BatchAddReferences(ctx context.Context, fileID int32, references []FileReferenceInfo) error {
	for _, ref := range references {
		err := s.AddFileReference(ctx, AddFileReferenceParams{
			FileID:           fileID,
			EntityType:       ref.EntityType,
			EntityID:         ref.EntityID,
			FieldName:        ref.FieldName,
			ReferenceType:    ref.ReferenceType,
			CreatedByUserID:  ref.CreatedByUserID,
		})
		if err != nil {
			return fmt.Errorf("failed to add reference for entity %s:%d: %w", ref.EntityType, ref.EntityID, err)
		}
	}
	return nil
}

func (s *fileTrackingService) BatchRemoveReferences(ctx context.Context, entityType string, entityID int32) error {
	// Get all references for this entity
	references, err := s.GetFileReferences(ctx, entityType, entityID)
	if err != nil {
		return fmt.Errorf("failed to get references: %w", err)
	}

	// Remove each reference
	for _, ref := range references {
		err := s.RemoveFileReference(ctx, RemoveFileReferenceParams{
			FileID:     ref.FileID,
			EntityType: entityType,
			EntityID:   entityID,
		})
		if err != nil {
			return fmt.Errorf("failed to remove reference for file %d: %w", ref.FileID, err)
		}
	}

	return nil
}

func (s *fileTrackingService) BatchCleanupFiles(ctx context.Context, fileIDs []int32) (*CleanupResult, error) {
	startTime := time.Now()
	result := &CleanupResult{
		FilesProcessed: int32(len(fileIDs)),
		StartTime:      startTime,
	}

	for _, fileID := range fileIDs {
		if err := s.DeleteFileUpload(ctx, fileID); err != nil {
			result.FilesFailed++
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to delete file %d: %v", fileID, err))
		} else {
			result.FilesDeleted++
		}
	}

	result.EndTime = time.Now()
	result.Duration = result.EndTime.Sub(result.StartTime)

	return result, nil
}