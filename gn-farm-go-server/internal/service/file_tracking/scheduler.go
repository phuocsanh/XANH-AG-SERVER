package file_tracking

import (
	"context"
	"log"
	"time"
)

// Scheduler handles scheduled cleanup jobs
type Scheduler struct {
	service FileTrackingService
	config  SchedulerConfig
}

// SchedulerConfig contains configuration for the scheduler
type SchedulerConfig struct {
	// CleanupInterval is the interval between cleanup runs
	CleanupInterval time.Duration
	// TemporaryFileMaxAge is the maximum age of temporary files before they're deleted
	TemporaryFileMaxAge time.Duration
	// OrphanedFileGracePeriod is the grace period before deleting orphaned files
	OrphanedFileGracePeriod time.Duration
}

// DefaultSchedulerConfig returns default scheduler configuration
func DefaultSchedulerConfig() SchedulerConfig {
	return SchedulerConfig{
		CleanupInterval:         3 * time.Minute, // Run daily
		TemporaryFileMaxAge:     3 * time.Minute, // Delete temp files older than 24h
		OrphanedFileGracePeriod: 3 * time.Minute, // Delete orphaned files after 7 days
	}
}

// NewScheduler creates a new scheduler
func NewScheduler(service FileTrackingService, config SchedulerConfig) *Scheduler {
	if config.CleanupInterval == 0 {
		config = DefaultSchedulerConfig()
	}
	return &Scheduler{
		service: service,
		config:  config,
	}
}

// Start starts the scheduler
func (s *Scheduler) Start(ctx context.Context) {
	log.Printf("[FILE_TRACKING_SCHEDULER] Starting scheduler with interval: %v, TempFileMaxAge: %v, OrphanedGracePeriod: %v", 
		s.config.CleanupInterval, s.config.TemporaryFileMaxAge, s.config.OrphanedFileGracePeriod)
	ticker := time.NewTicker(s.config.CleanupInterval)
	defer ticker.Stop()

	// Run immediately on start
	log.Printf("[FILE_TRACKING_SCHEDULER] Running initial cleanup...")
	s.runCleanup(ctx)

	for {
		select {
		case <-ctx.Done():
			log.Println("[FILE_TRACKING_SCHEDULER] Stopping file cleanup scheduler")
			return
		case <-ticker.C:
			log.Printf("[FILE_TRACKING_SCHEDULER] Ticker triggered - running scheduled cleanup at %v", time.Now())
			s.runCleanup(ctx)
		}
	}
}

func (s *Scheduler) runCleanup(ctx context.Context) {
	log.Printf("[FILE_TRACKING_SCHEDULER] Starting scheduled file cleanup at %v...", time.Now())

	// Cleanup temporary files
	log.Printf("[FILE_TRACKING_SCHEDULER] Cleaning up temporary files older than %v", s.config.TemporaryFileMaxAge)
	if result, err := s.service.CleanupTemporaryFiles(ctx, s.config.TemporaryFileMaxAge); err != nil {
		log.Printf("[FILE_TRACKING_SCHEDULER] Error cleaning up temporary files: %v", err)
	} else {
		log.Printf("[FILE_TRACKING_SCHEDULER] Temporary files cleanup result: Processed=%d, Deleted=%d, Failed=%d", 
			result.FilesProcessed, result.FilesDeleted, result.FilesFailed)
	}

	// Cleanup orphaned files
	log.Printf("[FILE_TRACKING_SCHEDULER] Cleaning up orphaned files older than %v", s.config.OrphanedFileGracePeriod)
	if result, err := s.service.CleanupOrphanedFiles(ctx, s.config.OrphanedFileGracePeriod); err != nil {
		log.Printf("[FILE_TRACKING_SCHEDULER] Error cleaning up orphaned files: %v", err)
	} else {
		log.Printf("[FILE_TRACKING_SCHEDULER] Orphaned files cleanup result: Processed=%d, Deleted=%d, Failed=%d", 
			result.FilesProcessed, result.FilesDeleted, result.FilesFailed)
	}

	log.Printf("[FILE_TRACKING_SCHEDULER] Scheduled file cleanup completed at %v", time.Now())
}
