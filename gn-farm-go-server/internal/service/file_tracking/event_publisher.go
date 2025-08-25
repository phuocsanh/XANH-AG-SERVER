package file_tracking

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisEventPublisher implements EventPublisher using Redis Pub/Sub
type RedisEventPublisher struct {
	client    *redis.Client
	channelPrefix string
}

// NewRedisEventPublisher creates a new Redis event publisher
func NewRedisEventPublisher(client *redis.Client, channelPrefix string) *RedisEventPublisher {
	if channelPrefix == "" {
		channelPrefix = "file_events"
	}
	return &RedisEventPublisher{
		client:        client,
		channelPrefix: channelPrefix,
	}
}

// PublishFileEvent publishes a file event to Redis
func (p *RedisEventPublisher) PublishFileEvent(ctx context.Context, event FileEvent) error {
	// Serialize event to JSON
	eventData, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Determine channel based on event type
	channel := fmt.Sprintf("%s:%s", p.channelPrefix, event.Type)

	// Publish to Redis
	err = p.client.Publish(ctx, channel, eventData).Err()
	if err != nil {
		return fmt.Errorf("failed to publish event to Redis: %w", err)
	}

	log.Printf("Published file event: type=%s, fileID=%d, action=%s", event.Type, event.FileID, event.Action)
	return nil
}

// FileEventConsumer handles consuming file events from Redis
type FileEventConsumer struct {
	client         *redis.Client
	channelPrefix  string
	fileService    FileTrackingService
	handlers       map[string]FileEventHandler
}

// FileEventHandler defines the interface for handling file events
type FileEventHandler interface {
	HandleEvent(ctx context.Context, event FileEvent) error
}

// NewFileEventConsumer creates a new file event consumer
func NewFileEventConsumer(
	client *redis.Client,
	channelPrefix string,
	fileService FileTrackingService,
) *FileEventConsumer {
	if channelPrefix == "" {
		channelPrefix = "file_events"
	}
	return &FileEventConsumer{
		client:        client,
		channelPrefix: channelPrefix,
		fileService:   fileService,
		handlers:      make(map[string]FileEventHandler),
	}
}

// RegisterHandler registers an event handler for a specific event type
func (c *FileEventConsumer) RegisterHandler(eventType string, handler FileEventHandler) {
	c.handlers[eventType] = handler
}

// Start starts consuming events from Redis
func (c *FileEventConsumer) Start(ctx context.Context) error {
	// Subscribe to all file event channels
	channels := []string{
		fmt.Sprintf("%s:%s", c.channelPrefix, FileEventUpload),
		fmt.Sprintf("%s:%s", c.channelPrefix, FileEventDeleted),
		fmt.Sprintf("%s:%s", c.channelPrefix, FileEventReferenceAdd),
		fmt.Sprintf("%s:%s", c.channelPrefix, FileEventReferenceRemove),
		fmt.Sprintf("%s:%s", c.channelPrefix, FileEventOrphaned),
		fmt.Sprintf("%s:%s", c.channelPrefix, FileEventCleanup),
	}

	pubsub := c.client.Subscribe(ctx, channels...)
	defer pubsub.Close()

	log.Printf("Started file event consumer, listening on channels: %v", channels)

	// Listen for messages
	ch := pubsub.Channel()
	for {
		select {
		case msg := <-ch:
			if err := c.handleMessage(ctx, msg); err != nil {
				log.Printf("Error handling message: %v", err)
			}
		case <-ctx.Done():
			log.Println("File event consumer stopped")
			return ctx.Err()
		}
	}
}

// handleMessage processes a single Redis message
func (c *FileEventConsumer) handleMessage(ctx context.Context, msg *redis.Message) error {
	// Parse event from message
	var event FileEvent
	if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
		return fmt.Errorf("failed to unmarshal event: %w", err)
	}

	// Get handler for event type
	handler, exists := c.handlers[event.Type]
	if !exists {
		// Use default handler
		return c.handleDefaultEvent(ctx, event)
	}

	// Handle event
	return handler.HandleEvent(ctx, event)
}

// handleDefaultEvent provides default handling for events without specific handlers
func (c *FileEventConsumer) handleDefaultEvent(ctx context.Context, event FileEvent) error {
	log.Printf("Handling default event: type=%s, fileID=%d, action=%s", event.Type, event.FileID, event.Action)

	switch event.Type {
	case FileEventReferenceAdd, FileEventReferenceRemove:
		// Update reference count when references change
		return c.fileService.UpdateReferenceCount(ctx, event.FileID)
	
	case FileEventOrphaned:
		// Log orphaned file for monitoring
		log.Printf("File %d became orphaned", event.FileID)
		return nil
	
	case FileEventUpload:
		// Log file upload for monitoring
		log.Printf("File %d uploaded: %s", event.FileID, event.PublicID)
		return nil
	
	case FileEventDeleted:
		// Log file deletion for monitoring
		log.Printf("File %d deleted: %s", event.FileID, event.PublicID)
		return nil
	
	default:
		log.Printf("Unknown event type: %s", event.Type)
		return nil
	}
}

// OrphanedFileHandler handles orphaned file events
type OrphanedFileHandler struct {
	fileService   FileTrackingService
	gracePeriod   time.Duration
	autoCleanup   bool
}

// NewOrphanedFileHandler creates a new orphaned file handler
func NewOrphanedFileHandler(
	fileService FileTrackingService,
	gracePeriod time.Duration,
	autoCleanup bool,
) *OrphanedFileHandler {
	return &OrphanedFileHandler{
		fileService: fileService,
		gracePeriod: gracePeriod,
		autoCleanup: autoCleanup,
	}
}

// HandleEvent handles orphaned file events
func (h *OrphanedFileHandler) HandleEvent(ctx context.Context, event FileEvent) error {
	log.Printf("Handling orphaned file event: fileID=%d", event.FileID)

	if !h.autoCleanup {
		// Just log the event if auto cleanup is disabled
		log.Printf("File %d is orphaned but auto cleanup is disabled", event.FileID)
		return nil
	}

	// Schedule cleanup after grace period
	// In a real implementation, you might use a job scheduler like cron or a delayed job queue
	go func() {
		time.Sleep(h.gracePeriod)
		
		// Create a new context for the cleanup operation
		cleanupCtx := context.Background()
		
		// Check if file is still orphaned
		file, err := h.fileService.GetFileUploadByID(cleanupCtx, event.FileID)
		if err != nil {
			log.Printf("Failed to get file %d for cleanup: %v", event.FileID, err)
			return
		}
		
		if file.IsOrphaned.Valid && file.IsOrphaned.Bool && file.MarkedForDeletionAt.Valid {
			// File is still orphaned, proceed with cleanup
			if err := h.fileService.DeleteFileUpload(cleanupCtx, event.FileID); err != nil {
				log.Printf("Failed to cleanup orphaned file %d: %v", event.FileID, err)
			} else {
				log.Printf("Successfully cleaned up orphaned file %d", event.FileID)
			}
		} else {
			log.Printf("File %d is no longer orphaned, skipping cleanup", event.FileID)
		}
	}()

	return nil
}

// ReferenceCountHandler handles reference count change events
type ReferenceCountHandler struct {
	fileService FileTrackingService
}

// NewReferenceCountHandler creates a new reference count handler
func NewReferenceCountHandler(fileService FileTrackingService) *ReferenceCountHandler {
	return &ReferenceCountHandler{
		fileService: fileService,
	}
}

// HandleEvent handles reference count change events
func (h *ReferenceCountHandler) HandleEvent(ctx context.Context, event FileEvent) error {
	log.Printf("Handling reference count change: fileID=%d, action=%s", event.FileID, event.Action)

	// Update reference count
	return h.fileService.UpdateReferenceCount(ctx, event.FileID)
}

// CleanupScheduler handles scheduled cleanup operations
type CleanupScheduler struct {
	fileService        FileTrackingService
	temporaryFileAge   time.Duration
	orphanedGracePeriod time.Duration
	cleanupInterval    time.Duration
}

// NewCleanupScheduler creates a new cleanup scheduler
func NewCleanupScheduler(
	fileService FileTrackingService,
	temporaryFileAge time.Duration,
	orphanedGracePeriod time.Duration,
	cleanupInterval time.Duration,
) *CleanupScheduler {
	return &CleanupScheduler{
		fileService:         fileService,
		temporaryFileAge:    temporaryFileAge,
		orphanedGracePeriod: orphanedGracePeriod,
		cleanupInterval:     cleanupInterval,
	}
}

// Start starts the cleanup scheduler
func (s *CleanupScheduler) Start(ctx context.Context) error {
	ticker := time.NewTicker(s.cleanupInterval)
	defer ticker.Stop()

	log.Printf("[EVENT_PUBLISHER_SCHEDULER] Started cleanup scheduler with interval: %v, TempFileAge: %v, OrphanedGracePeriod: %v", 
		s.cleanupInterval, s.temporaryFileAge, s.orphanedGracePeriod)

	for {
		select {
		case <-ticker.C:
			log.Printf("[EVENT_PUBLISHER_SCHEDULER] Ticker triggered - running cleanup at %v", time.Now())
			if err := s.runCleanup(ctx); err != nil {
				log.Printf("[EVENT_PUBLISHER_SCHEDULER] Cleanup failed: %v", err)
			}
		case <-ctx.Done():
			log.Println("[EVENT_PUBLISHER_SCHEDULER] Cleanup scheduler stopped")
			return ctx.Err()
		}
	}
}

// runCleanup performs the actual cleanup operations
func (s *CleanupScheduler) runCleanup(ctx context.Context) error {
	log.Printf("[EVENT_PUBLISHER_SCHEDULER] Running scheduled cleanup at %v...", time.Now())

	// Cleanup temporary files
	log.Printf("[EVENT_PUBLISHER_SCHEDULER] Cleaning up temporary files older than %v", s.temporaryFileAge)
	tempResult, err := s.fileService.CleanupTemporaryFiles(ctx, s.temporaryFileAge)
	if err != nil {
		log.Printf("[EVENT_PUBLISHER_SCHEDULER] Failed to cleanup temporary files: %v", err)
	} else {
		log.Printf("[EVENT_PUBLISHER_SCHEDULER] Temporary file cleanup completed: processed=%d, deleted=%d, failed=%d",
			tempResult.FilesProcessed, tempResult.FilesDeleted, tempResult.FilesFailed)
	}

	// Cleanup orphaned files
	log.Printf("[EVENT_PUBLISHER_SCHEDULER] Cleaning up orphaned files with grace period %v", s.orphanedGracePeriod)
	orphanResult, err := s.fileService.CleanupOrphanedFiles(ctx, s.orphanedGracePeriod)
	if err != nil {
		log.Printf("[EVENT_PUBLISHER_SCHEDULER] Failed to cleanup orphaned files: %v", err)
	} else {
		log.Printf("[EVENT_PUBLISHER_SCHEDULER] Orphaned file cleanup completed: processed=%d, deleted=%d, failed=%d",
			orphanResult.FilesProcessed, orphanResult.FilesDeleted, orphanResult.FilesFailed)
	}

	// Mark orphaned files
	orphanedCount, err := s.fileService.MarkOrphanedFiles(ctx)
	if err != nil {
		log.Printf("[EVENT_PUBLISHER_SCHEDULER] Failed to mark orphaned files: %v", err)
	} else {
		log.Printf("[EVENT_PUBLISHER_SCHEDULER] Marked %d files as orphaned", orphanedCount)
	}

	return nil
}

// MockEventPublisher is a mock implementation for testing
type MockEventPublisher struct {
	Events []FileEvent
}

// NewMockEventPublisher creates a new mock event publisher
func NewMockEventPublisher() *MockEventPublisher {
	return &MockEventPublisher{
		Events: make([]FileEvent, 0),
	}
}

// PublishFileEvent records the event for testing
func (m *MockEventPublisher) PublishFileEvent(ctx context.Context, event FileEvent) error {
	m.Events = append(m.Events, event)
	return nil
}

// GetEvents returns all recorded events
func (m *MockEventPublisher) GetEvents() []FileEvent {
	return m.Events
}

// ClearEvents clears all recorded events
func (m *MockEventPublisher) ClearEvents() {
	m.Events = make([]FileEvent, 0)
}