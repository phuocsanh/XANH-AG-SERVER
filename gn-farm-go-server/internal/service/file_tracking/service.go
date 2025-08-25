package file_tracking

import (
	"context"
	"time"

	"gn-farm-go-server/internal/database"
)

// FileTrackingService interface cho quản lý file tracking với reference counting
type FileTrackingService interface {
	// File Upload Management
	CreateFileUpload(ctx context.Context, params CreateFileUploadParams) (*database.FileUpload, error)
	GetFileUploadByPublicID(ctx context.Context, publicID string) (*database.FileUpload, error)
	GetFileUploadByID(ctx context.Context, id int32) (*database.FileUpload, error)
	DeleteFileUpload(ctx context.Context, id int32) error
	
	// Reference Counting
	AddFileReference(ctx context.Context, params AddFileReferenceParams) error
	RemoveFileReference(ctx context.Context, params RemoveFileReferenceParams) error
	GetFileReferences(ctx context.Context, entityType string, entityID int32) ([]database.GetFileReferencesRow, error)
	UpdateReferenceCount(ctx context.Context, fileID int32) error
	
	// Orphan Detection & Cleanup
	MarkOrphanedFiles(ctx context.Context) (int, error)
	CleanupTemporaryFiles(ctx context.Context, olderThan time.Duration) (*CleanupResult, error)
	CleanupOrphanedFiles(ctx context.Context, gracePeriod time.Duration) (*CleanupResult, error)
	ScheduleCleanupJob(ctx context.Context, jobType string, params map[string]interface{}) (*database.FileCleanupJob, error)
	
	// Audit & Monitoring
	LogFileAction(ctx context.Context, params LogFileActionParams) error
	GetFileStatistics(ctx context.Context) (*database.GetFileStatisticsRow, error)
	GetAuditLogs(ctx context.Context, params GetAuditLogsParams) ([]database.GetFileAuditLogsRow, error)
	
	// Batch Operations
	BatchAddReferences(ctx context.Context, fileID int32, references []FileReferenceInfo) error
	BatchRemoveReferences(ctx context.Context, entityType string, entityID int32) error
	BatchCleanupFiles(ctx context.Context, fileIDs []int32) (*CleanupResult, error)
}

// Structs for parameters
type CreateFileUploadParams struct {
	PublicID         string
	FileURL          string
	FileName         string
	FileType         string
	FileSize         int64
	Folder           *string
	MimeType         *string
	UploadedByUserID *int32
	Tags             []string
	Metadata         map[string]interface{}
	IsTemporary      *bool
}

type AddFileReferenceParams struct {
	FileID           int32
	EntityType       string
	EntityID         int32
	FieldName        *string
	ReferenceType    string // 'active', 'archived'
	CreatedByUserID  *int32
}

type RemoveFileReferenceParams struct {
	FileID          int32
	EntityType      string
	EntityID        int32
	DeletedByUserID *int32
}

type FileReferenceInfo struct {
	EntityType      string
	EntityID        int32
	FieldName       *string
	ReferenceType   string
	CreatedByUserID *int32
}

type LogFileActionParams struct {
	FileID               *int32
	Action               string // 'upload', 'reference_add', 'reference_remove', 'mark_orphaned', 'cleanup', 'delete'
	EntityType           *string
	EntityID             *int32
	OldReferenceCount    *int32
	NewReferenceCount    *int32
	Details              map[string]interface{}
	PerformedByUserID    *int32
	IPAddress            *string
	UserAgent            *string
}

type GetAuditLogsParams struct {
	FileID            *int32
	Action            *string
	PerformedByUserID *int32
	StartTime         time.Time
	EndTime           time.Time
	Limit             int32
	Offset            int32
}

type CleanupResult struct {
	JobID           int32
	FilesProcessed  int32
	FilesDeleted    int32
	FilesFailed     int32
	Errors          []string
	StartTime       time.Time
	EndTime         time.Time
	Duration        time.Duration
}

// Event types for message queue
type FileEvent struct {
	Type      string                 `json:"type"`
	FileID    int32                  `json:"file_id"`
	PublicID  string                 `json:"public_id"`
	Action    string                 `json:"action"`
	EntityType *string               `json:"entity_type,omitempty"`
	EntityID   *int32                `json:"entity_id,omitempty"`
	UserID     *int32                `json:"user_id,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	Timestamp  time.Time              `json:"timestamp"`
}

const (
	// File Event Types
	FileEventUpload         = "file.upload"
	FileEventReferenceAdd   = "file.reference.add"
	FileEventReferenceRemove = "file.reference.remove"
	FileEventOrphaned       = "file.orphaned"
	FileEventCleanup        = "file.cleanup"
	FileEventDeleted        = "file.deleted"
	
	// Reference Types
	ReferenceTypeActive   = "active"
	ReferenceTypeArchived = "archived"
	ReferenceTypePrimary  = "primary"
	
	// Cleanup Job Types
	CleanupJobTemporary = "temporary_cleanup"
	CleanupJobOrphaned  = "orphan_cleanup"
	CleanupJobScheduled = "scheduled_cleanup"
	CleanupJobManual    = "manual_cleanup"
	
	// Action Types
	ActionUpload         = "upload"
	ActionReferenceAdd   = "reference_add"
	ActionReferenceRemove = "reference_remove"
	ActionMarkOrphaned   = "mark_orphaned"
	ActionCleanup        = "cleanup"
	ActionDelete         = "delete"
)