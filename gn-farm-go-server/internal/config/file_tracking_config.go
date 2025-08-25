package config

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"gn-farm-go-server/internal/database"
	"gn-farm-go-server/internal/service/file_tracking"
	"gn-farm-go-server/internal/service/upload"
)

// fileTrackingServiceAdapter là adapter để chuyển đổi FileTrackingService thành FileTrackingService interface của upload package
type fileTrackingServiceAdapter struct {
	svc file_tracking.FileTrackingService
}

// NewFileTrackingServiceAdapter creates a new file tracking service adapter
func NewFileTrackingServiceAdapter(svc file_tracking.FileTrackingService) *fileTrackingServiceAdapter {
	return &fileTrackingServiceAdapter{svc: svc}
}

// CreateFileUpload triển khai interface FileTrackingService của upload package
func (a *fileTrackingServiceAdapter) CreateFileUpload(ctx context.Context, params interface{}) (interface{}, error) {
	// Chuyển đổi params từ map sang CreateFileUploadParams
	p, ok := params.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid params type: %T", params)
	}

	// Tạo CreateFileUploadParams
	createParams := file_tracking.CreateFileUploadParams{
		PublicID: p["public_id"].(string),
		FileURL:  p["file_url"].(string),
		FileName: p["file_name"].(string),
		FileType: p["file_type"].(string),
		FileSize: p["file_size"].(int64),
	}

	// Thêm các trường optional nếu có
	if folder, ok := p["folder"].(string); ok && folder != "" {
		createParams.Folder = &folder
	}

	if mimeType, ok := p["mime_type"].(string); ok && mimeType != "" {
		createParams.MimeType = &mimeType
	}

	if tags, ok := p["tags"].([]string); ok && len(tags) > 0 {
		createParams.Tags = tags
		log.Printf("[FILE_TRACKING_CONFIG] Processing tags: %v", tags)
		// Kiểm tra nếu có tag "temporary" thì đánh dấu file là temporary
		for _, tag := range tags {
			if tag == "temporary" {
				isTemp := true
				createParams.IsTemporary = &isTemp
				log.Printf("[FILE_TRACKING_CONFIG] Found temporary tag, setting IsTemporary to true")
				break
			}
		}
	} else {
		log.Printf("[FILE_TRACKING_CONFIG] No tags found or type assertion failed. Tags value: %v, Type: %T", p["tags"], p["tags"])
	}

	// Gọi service thực tế
	return a.svc.CreateFileUpload(ctx, createParams)
}

// FileTrackingConfig contains configuration for file tracking system
type FileTrackingConfig struct {
	// Database configuration
	Database struct {
		Enabled bool `mapstructure:"enabled" default:"true"`
	}
	
	// Redis configuration for event publishing
	Redis struct {
		Enabled       bool   `mapstructure:"enabled" default:"true"`
		URL           string `mapstructure:"url" default:"redis://localhost:6379"`
		ChannelPrefix string `mapstructure:"channel_prefix" default:"file_events"`
	}
	
	// Cleanup configuration
	Cleanup struct {
		// Temporary files cleanup
		Temporary struct {
			Enabled bool          `mapstructure:"enabled" default:"true"`
			MaxAge  time.Duration `mapstructure:"max_age" default:"24h"`
		}
		
		// Orphaned files cleanup
		Orphaned struct {
			Enabled     bool          `mapstructure:"enabled" default:"true"`
			GracePeriod time.Duration `mapstructure:"grace_period" default:"168h"` // 7 days
			AutoCleanup bool          `mapstructure:"auto_cleanup" default:"false"`
		}
		
		// Scheduled cleanup
		Scheduled struct {
			Enabled  bool          `mapstructure:"enabled" default:"true"`
			Interval time.Duration `mapstructure:"interval" default:"6h"`
		}
		
		// API configuration
		API struct {
			Enabled bool   `mapstructure:"enabled" default:"true"`
			APIKey  string `mapstructure:"api_key" default:""`
		}
	}
	
	// Event system configuration
	Events struct {
		Enabled    bool `mapstructure:"enabled" default:"true"`
		Consumer   bool `mapstructure:"consumer" default:"true"`
		Publisher  bool `mapstructure:"publisher" default:"true"`
	}
	
	// Middleware configuration
	Middleware struct {
		Enabled      bool `mapstructure:"enabled" default:"true"`
		TrackUploads bool `mapstructure:"track_uploads" default:"true"`
		TrackChanges bool `mapstructure:"track_changes" default:"true"`
	}
	
	// Webhooks configuration
	Webhooks struct {
		Enabled       bool   `mapstructure:"enabled" default:"false"`
		Secret        string `mapstructure:"secret" default:""`
		Cloudinary    bool   `mapstructure:"cloudinary" default:"false"`
		S3            bool   `mapstructure:"s3" default:"false"`
	}
	
	// Monitoring configuration
	Monitoring struct {
		Enabled     bool `mapstructure:"enabled" default:"true"`
		HealthCheck bool `mapstructure:"health_check" default:"true"`
		Metrics     bool `mapstructure:"metrics" default:"true"`
	}
}

// FileTrackingDependencies contains all dependencies for file tracking system
type FileTrackingDependencies struct {
	// Core services
	FileService    file_tracking.FileTrackingService
	EventPublisher file_tracking.EventPublisher
	
	// Helpers and utilities
	Helper        *file_tracking.FileTrackingHelper
	Extractor     *file_tracking.FileURLExtractor
	Validator     *file_tracking.ValidationHelper
	
	// Middleware
	FileTrackingMiddleware *file_tracking.FileTrackingMiddleware
	UploadMiddleware       *file_tracking.FileUploadMiddleware
	CleanupMiddleware      *file_tracking.CleanupMiddleware
	
	// Handlers
	FileTrackingHandler *file_tracking.FileTrackingHandler
	
	// Background services
	EventConsumer     *file_tracking.FileEventConsumer
	CleanupScheduler  *file_tracking.CleanupScheduler
	
	// Event handlers
	OrphanedFileHandler   *file_tracking.OrphanedFileHandler
	ReferenceCountHandler *file_tracking.ReferenceCountHandler
}

// SetupFileTrackingDependencies sets up all file tracking dependencies
func SetupFileTrackingDependencies(
	config FileTrackingConfig,
	db *database.Queries,
	sqlDB *sql.DB,
	redisClient *redis.Client,
) (*FileTrackingDependencies, error) {
	deps := &FileTrackingDependencies{}
	
	// Setup event publisher
	if config.Events.Enabled && config.Events.Publisher {
		if config.Redis.Enabled && redisClient != nil {
			deps.EventPublisher = file_tracking.NewRedisEventPublisher(
				redisClient,
				config.Redis.ChannelPrefix,
			)
		} else {
			// Use mock publisher for testing or when Redis is disabled
			deps.EventPublisher = file_tracking.NewMockEventPublisher()
		}
	}
	
	// Setup core file tracking service
	deps.FileService = file_tracking.NewFileTrackingService(
		db,
		deps.EventPublisher,
		nil, // uploadService sẽ được cấu hình sau
	)

	// Create upload service with config
	uploadConfig, err := upload.ProvideConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to create upload config: %v", err)
	}

	// Tạo file tracking service adapter
	fileTrackingSvcAdapter := &fileTrackingServiceAdapter{
		svc: deps.FileService,
	}

	// Tạo upload service với file tracking service
	uploadService, err := upload.NewCloudinaryService(uploadConfig, fileTrackingSvcAdapter)
	if err != nil {
		// Nếu không thể khởi tạo CloudinaryService, vẫn tiếp tục với service nil
		uploadService = nil
	}

	// Cập nhật upload service trong file tracking service
	if fts, ok := deps.FileService.(interface{ SetUploadService(service upload.UploadService) }); ok && uploadService != nil {
		fts.SetUploadService(uploadService)
	}
	
	// Setup helpers and utilities
	deps.Helper = file_tracking.NewFileTrackingHelper(deps.FileService)
	deps.Extractor = file_tracking.NewFileURLExtractor()
	deps.Validator = file_tracking.NewValidationHelper()
	
	// Setup middleware
	if config.Middleware.Enabled {
		deps.FileTrackingMiddleware = file_tracking.NewFileTrackingMiddleware(
			deps.Helper,
			deps.Extractor,
			deps.Validator,
		)
		
		if config.Middleware.TrackUploads {
			deps.UploadMiddleware = file_tracking.NewFileUploadMiddleware(deps.Helper)
		}
		
		if config.Cleanup.API.Enabled {
			deps.CleanupMiddleware = file_tracking.NewCleanupMiddleware(deps.Helper)
		}
	}
	
	// Setup handlers
	if config.Cleanup.API.Enabled || config.Monitoring.Enabled {
		deps.FileTrackingHandler = file_tracking.NewFileTrackingHandler(
			deps.FileService,
			deps.Helper,
		)
	}
	
	// Setup event consumer and handlers
	if config.Events.Enabled && config.Events.Consumer && redisClient != nil {
		deps.EventConsumer = file_tracking.NewFileEventConsumer(
			redisClient,
			config.Redis.ChannelPrefix,
			deps.FileService,
		)
		
		// Setup event handlers
		deps.OrphanedFileHandler = file_tracking.NewOrphanedFileHandler(
			deps.FileService,
			config.Cleanup.Orphaned.GracePeriod,
			config.Cleanup.Orphaned.AutoCleanup,
		)
		
		deps.ReferenceCountHandler = file_tracking.NewReferenceCountHandler(
			deps.FileService,
		)
		
		// Register event handlers
		deps.EventConsumer.RegisterHandler(
			file_tracking.FileEventOrphaned,
			deps.OrphanedFileHandler,
		)
		
		deps.EventConsumer.RegisterHandler(
			file_tracking.FileEventReferenceAdd,
			deps.ReferenceCountHandler,
		)
		
		deps.EventConsumer.RegisterHandler(
			file_tracking.FileEventReferenceRemove,
			deps.ReferenceCountHandler,
		)
	}
	
	// Setup cleanup scheduler
	if config.Cleanup.Scheduled.Enabled {
		deps.CleanupScheduler = file_tracking.NewCleanupScheduler(
			deps.FileService,
			config.Cleanup.Temporary.MaxAge,
			config.Cleanup.Orphaned.GracePeriod,
			config.Cleanup.Scheduled.Interval,
		)
	}
	
	return deps, nil
}

// StartFileTrackingServices starts background services for file tracking
func StartFileTrackingServices(
	ctx context.Context,
	config FileTrackingConfig,
	deps *FileTrackingDependencies,
) error {
	// Start event consumer
	if config.Events.Enabled && config.Events.Consumer && deps.EventConsumer != nil {
		go func() {
			if err := deps.EventConsumer.Start(ctx); err != nil {
				log.Printf("File event consumer stopped: %v", err)
			}
		}()
		log.Println("Started file event consumer")
	}
	
	// Start cleanup scheduler
	if config.Cleanup.Scheduled.Enabled && deps.CleanupScheduler != nil {
		go func() {
			if err := deps.CleanupScheduler.Start(ctx); err != nil {
				log.Printf("Cleanup scheduler stopped: %v", err)
			}
		}()
		log.Printf("Started cleanup scheduler with interval: %v", config.Cleanup.Scheduled.Interval)
	}
	
	return nil
}

// ValidateFileTrackingConfig validates the file tracking configuration
func ValidateFileTrackingConfig(config FileTrackingConfig) error {
	// Validate cleanup API key if cleanup API is enabled
	if config.Cleanup.API.Enabled && config.Cleanup.API.APIKey == "" {
		return fmt.Errorf("cleanup API key is required when cleanup API is enabled")
	}
	
	// Validate webhook secret if webhooks are enabled
	if config.Webhooks.Enabled && config.Webhooks.Secret == "" {
		return fmt.Errorf("webhook secret is required when webhooks are enabled")
	}
	
	// Validate Redis URL if Redis is enabled
	if config.Redis.Enabled && config.Redis.URL == "" {
		return fmt.Errorf("Redis URL is required when Redis is enabled")
	}
	
	// Validate time durations
	if config.Cleanup.Temporary.MaxAge <= 0 {
		return fmt.Errorf("temporary file max age must be positive")
	}
	
	if config.Cleanup.Orphaned.GracePeriod <= 0 {
		return fmt.Errorf("orphaned file grace period must be positive")
	}
	
	if config.Cleanup.Scheduled.Interval <= 0 {
		return fmt.Errorf("cleanup scheduled interval must be positive")
	}
	
	return nil
}

// GetDefaultFileTrackingConfig returns default configuration
func GetDefaultFileTrackingConfig() FileTrackingConfig {
	return FileTrackingConfig{
		Database: struct {
			Enabled bool `mapstructure:"enabled" default:"true"`
		}{
			Enabled: true,
		},
		Redis: struct {
			Enabled       bool   `mapstructure:"enabled" default:"true"`
			URL           string `mapstructure:"url" default:"redis://localhost:6379"`
			ChannelPrefix string `mapstructure:"channel_prefix" default:"file_events"`
		}{
			Enabled:       true,
			URL:           "redis://localhost:6379",
			ChannelPrefix: "file_events",
		},
		Cleanup: struct {
			Temporary struct {
				Enabled bool          `mapstructure:"enabled" default:"true"`
				MaxAge  time.Duration `mapstructure:"max_age" default:"24h"`
			}
			Orphaned struct {
				Enabled     bool          `mapstructure:"enabled" default:"true"`
				GracePeriod time.Duration `mapstructure:"grace_period" default:"168h"`
				AutoCleanup bool          `mapstructure:"auto_cleanup" default:"false"`
			}
			Scheduled struct {
				Enabled  bool          `mapstructure:"enabled" default:"true"`
				Interval time.Duration `mapstructure:"interval" default:"6h"`
			}
			API struct {
				Enabled bool   `mapstructure:"enabled" default:"true"`
				APIKey  string `mapstructure:"api_key" default:""`
			}
		}{
			Temporary: struct {
				Enabled bool          `mapstructure:"enabled" default:"true"`
				MaxAge  time.Duration `mapstructure:"max_age" default:"24h"`
			}{
				Enabled: true,
				MaxAge:  24 * time.Hour,
			},
			Orphaned: struct {
				Enabled     bool          `mapstructure:"enabled" default:"true"`
				GracePeriod time.Duration `mapstructure:"grace_period" default:"168h"`
				AutoCleanup bool          `mapstructure:"auto_cleanup" default:"false"`
			}{
				Enabled:     true,
				GracePeriod: 168 * time.Hour, // 7 days
				AutoCleanup: false,
			},
			Scheduled: struct {
				Enabled  bool          `mapstructure:"enabled" default:"true"`
				Interval time.Duration `mapstructure:"interval" default:"6h"`
			}{
				Enabled:  true,
				Interval: 6 * time.Hour,
			},
			API: struct {
				Enabled bool   `mapstructure:"enabled" default:"true"`
				APIKey  string `mapstructure:"api_key" default:""`
			}{
				Enabled: true,
				APIKey:  "",
			},
		},
		Events: struct {
			Enabled   bool `mapstructure:"enabled" default:"true"`
			Consumer  bool `mapstructure:"consumer" default:"true"`
			Publisher bool `mapstructure:"publisher" default:"true"`
		}{
			Enabled:   true,
			Consumer:  true,
			Publisher: true,
		},
		Middleware: struct {
			Enabled      bool `mapstructure:"enabled" default:"true"`
			TrackUploads bool `mapstructure:"track_uploads" default:"true"`
			TrackChanges bool `mapstructure:"track_changes" default:"true"`
		}{
			Enabled:      true,
			TrackUploads: true,
			TrackChanges: true,
		},
		Webhooks: struct {
			Enabled    bool   `mapstructure:"enabled" default:"false"`
			Secret     string `mapstructure:"secret" default:""`
			Cloudinary bool   `mapstructure:"cloudinary" default:"false"`
			S3         bool   `mapstructure:"s3" default:"false"`
		}{
			Enabled:    false,
			Secret:     "",
			Cloudinary: false,
			S3:         false,
		},
		Monitoring: struct {
			Enabled     bool `mapstructure:"enabled" default:"true"`
			HealthCheck bool `mapstructure:"health_check" default:"true"`
			Metrics     bool `mapstructure:"metrics" default:"true"`
		}{
			Enabled:     true,
			HealthCheck: true,
			Metrics:     true,
		},
	}
}

// LoadFileTrackingConfigFromEnv loads configuration from environment variables
func LoadFileTrackingConfigFromEnv() FileTrackingConfig {
	config := GetDefaultFileTrackingConfig()
	
	// Override with environment variables if present
	// This would typically use a library like viper or envconfig
	// For now, we'll just return the default config
	
	return config
}

// Example usage in main application:
// func main() {
//     // Load configuration
//     config := LoadFileTrackingConfigFromEnv()
//     
//     // Validate configuration
//     if err := ValidateFileTrackingConfig(config); err != nil {
//         log.Fatal("Invalid file tracking configuration:", err)
//     }
//     
//     // Setup dependencies
//     deps, err := SetupFileTrackingDependencies(
//         config,
//         db,
//         sqlDB,
//         uploadService,
//         redisClient,
//     )
//     if err != nil {
//         log.Fatal("Failed to setup file tracking dependencies:", err)
//     }
//     
//     // Start background services
//     ctx := context.Background()
//     if err := StartFileTrackingServices(ctx, config, deps); err != nil {
//         log.Fatal("Failed to start file tracking services:", err)
//     }
//     
//     // Setup routes
//     router := gin.New()
//     SetupFileTrackingWithConfig(router, config, deps)
// }