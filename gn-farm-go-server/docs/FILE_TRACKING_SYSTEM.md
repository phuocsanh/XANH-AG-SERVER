# File Tracking System Documentation

## Tổng quan

Hệ thống File Tracking được thiết kế để quản lý và theo dõi các file upload trong ứng dụng GN Farm, bao gồm:

- **Reference Counting**: Theo dõi số lượng tham chiếu đến mỗi file
- **Event-driven Cleanup**: Tự động dọn dẹp file dựa trên sự kiện
- **Database Tracking**: Ghi lại audit trail đầy đủ
- **Scheduled Cleanup**: Dọn dẹp định kỳ các file tạm thời và mồ côi

## Kiến trúc hệ thống

### 1. Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  File Upload    │    │  Reference      │    │  Event System   │
│  Tracking       │    │  Counting       │    │  (Redis Pub/Sub) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────────────────────────────────────┐
         │            Database Layer                       │
         │  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
         │  │file_uploads │  │file_references│ │audit_logs│ │
         │  └─────────────┘  └─────────────┘  └──────────┘ │
         └─────────────────────────────────────────────────┘
```

### 2. Database Schema

#### file_uploads
```sql
CREATE TABLE file_uploads (
    id SERIAL PRIMARY KEY,
    public_id VARCHAR(255) UNIQUE NOT NULL,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    folder VARCHAR(255),
    mime_type VARCHAR(100),
    uploaded_by_user_id INTEGER,
    tags TEXT[],
    metadata JSONB,
    reference_count INTEGER DEFAULT 0,
    is_temporary BOOLEAN DEFAULT TRUE,
    is_orphaned BOOLEAN DEFAULT FALSE,
    marked_for_deletion_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);
```

#### file_references
```sql
CREATE TABLE file_references (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES file_uploads(id),
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER NOT NULL,
    field_name VARCHAR(100),
    reference_type VARCHAR(50) DEFAULT 'primary',
    created_by_user_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);
```

## Cài đặt và Cấu hình

### 1. Database Migration

```bash
# Chạy migration để tạo các bảng cần thiết
psql -d your_database -f sql/schema/20241201001_file_tracking_system.sql
```

### 2. Environment Variables

```bash
# Redis configuration
REDIS_URL=redis://localhost:6379
FILE_EVENTS_CHANNEL_PREFIX=file_events

# Cleanup configuration
CLEANUP_API_KEY=your-secure-api-key
TEMPORARY_FILE_MAX_AGE=24h
ORPHANED_FILE_GRACE_PERIOD=168h
CLEANUP_INTERVAL=6h

# Feature flags
FILE_TRACKING_ENABLED=true
FILE_EVENTS_ENABLED=true
AUTO_CLEANUP_ENABLED=false
```

### 3. Code Integration

```go
package main

import (
    "context"
    "log"
    
    "github.com/gn-farm-go-server/internal/config"
    "github.com/gn-farm-go-server/internal/routers"
)

func main() {
    // Load configuration
    fileTrackingConfig := config.LoadFileTrackingConfigFromEnv()
    
    // Validate configuration
    if err := config.ValidateFileTrackingConfig(fileTrackingConfig); err != nil {
        log.Fatal("Invalid file tracking configuration:", err)
    }
    
    // Setup dependencies
    deps, err := config.SetupFileTrackingDependencies(
        fileTrackingConfig,
        db,
        sqlDB,
        uploadService,
        redisClient,
    )
    if err != nil {
        log.Fatal("Failed to setup file tracking dependencies:", err)
    }
    
    // Start background services
    ctx := context.Background()
    if err := config.StartFileTrackingServices(ctx, fileTrackingConfig, deps); err != nil {
        log.Fatal("Failed to start file tracking services:", err)
    }
    
    // Setup routes
    routeConfig := router.FileTrackingRouteConfig{
        EnableWebhooks:    true,
        EnableCronJobs:    true,
        EnableAdminRoutes: true,
        EnableMiddleware:  true,
        CleanupAPIKey:     fileTrackingConfig.Cleanup.API.APIKey,
    }
    
    router.SetupFileTrackingWithConfig(
        ginRouter,
        routeConfig,
        deps.FileTrackingHandler,
        deps.FileTrackingMiddleware,
        deps.CleanupMiddleware,
        deps.UploadMiddleware,
        deps.FileService,
        deps.CleanupScheduler,
    )
}
```

## Sử dụng

### 1. Automatic File Tracking

Hệ thống tự động theo dõi file thông qua middleware:

```go
// Middleware sẽ tự động track file changes
api.Use(fileTrackingMiddleware.TrackFileChanges())

// Upload middleware sẽ track file uploads
upload.Use(uploadMiddleware.TrackUpload())
```

### 2. Manual File Tracking

```go
// Track uploaded file
file, err := helper.TrackUploadedFile(
    ctx,
    publicID,
    fileURL,
    fileName,
    fileType,
    fileSize,
    userID,
    "product",
    productID,
    &fieldName,
    metadata,
)

// Update file references
err = helper.UpdateEntityFileReferences(
    ctx,
    "product",
    productID,
    "product_pictures",
    oldFileURLs,
    newFileURLs,
    userID,
)

// Remove all references when deleting entity
err = helper.RemoveEntityFileReferences(
    ctx,
    "product",
    productID,
    userID,
)
```

### 3. Cleanup Operations

#### Manual Cleanup via API

```bash
# Cleanup temporary files
curl -X POST "http://localhost:8080/api/admin/files/cleanup/temporary?max_age=24h&dry_run=false" \
  -H "X-Cleanup-API-Key: your-api-key"

# Cleanup orphaned files
curl -X POST "http://localhost:8080/api/admin/files/cleanup/orphaned?grace_period=168h&dry_run=false" \
  -H "X-Cleanup-API-Key: your-api-key"

# Mark orphaned files
curl -X POST "http://localhost:8080/api/admin/files/mark-orphaned" \
  -H "X-Cleanup-API-Key: your-api-key"
```

#### Programmatic Cleanup

```go
// Cleanup temporary files older than 24 hours
result, err := fileService.CleanupTemporaryFiles(ctx, 24*time.Hour)
if err != nil {
    log.Printf("Cleanup failed: %v", err)
} else {
    log.Printf("Cleaned up %d files", result.FilesDeleted)
}

// Cleanup orphaned files with 7-day grace period
result, err := fileService.CleanupOrphanedFiles(ctx, 7*24*time.Hour)
```

### 4. Monitoring và Statistics

```bash
# Get file statistics
curl "http://localhost:8080/api/admin/files/statistics" \
  -H "X-Cleanup-API-Key: your-api-key"

# Get audit logs
curl "http://localhost:8080/api/admin/files/audit-logs?limit=50&offset=0" \
  -H "X-Cleanup-API-Key: your-api-key"

# Health check
curl "http://localhost:8080/api/admin/files/health" \
  -H "X-Cleanup-API-Key: your-api-key"
```

## Event System

### Event Types

- `file:uploaded` - File được upload
- `file:deleted` - File bị xóa
- `file:reference_add` - Thêm reference mới
- `file:reference_remove` - Xóa reference
- `file:orphaned` - File trở thành mồ côi
- `file:cleanup` - File được dọn dẹp

### Event Handlers

```go
// Custom event handler
type CustomFileHandler struct {
    // your dependencies
}

func (h *CustomFileHandler) HandleEvent(ctx context.Context, event file_tracking.FileEvent) error {
    switch event.Type {
    case file_tracking.FileEventOrphaned:
        // Handle orphaned file
        log.Printf("File %d became orphaned", event.FileID)
    case file_tracking.FileEventDeleted:
        // Handle file deletion
        log.Printf("File %d was deleted", event.FileID)
    }
    return nil
}

// Register custom handler
eventConsumer.RegisterHandler(file_tracking.FileEventOrphaned, customHandler)
```

## Best Practices

### 1. File Upload Flow

```go
// 1. Upload file to cloud storage
uploadResult, err := uploadService.UploadImage(ctx, file)
if err != nil {
    return err
}

// 2. Track uploaded file
fileRecord, err := helper.TrackUploadedFile(
    ctx,
    uploadResult.PublicID,
    uploadResult.SecureURL,
    uploadResult.OriginalFilename,
    uploadResult.ResourceType,
    uploadResult.Bytes,
    userID,
    entityType,
    entityID,
    &fieldName,
    uploadResult.Metadata,
)
if err != nil {
    // Consider rolling back cloud upload
    uploadService.DeleteFile(ctx, uploadResult.PublicID)
    return err
}
```

### 2. Entity Update Flow

```go
// When updating entity with file fields
func UpdateProduct(ctx context.Context, productID int32, updateData ProductUpdateData) error {
    // Get current file URLs
    currentProduct, err := productService.GetByID(ctx, productID)
    if err != nil {
        return err
    }
    
    oldFileURLs := extractor.ExtractFromProductData(currentProduct)
    newFileURLs := extractor.ExtractFromProductData(updateData)
    
    // Update product
    err = productService.Update(ctx, productID, updateData)
    if err != nil {
        return err
    }
    
    // Update file references
    return helper.UpdateEntityFileReferences(
        ctx,
        "product",
        productID,
        "files",
        oldFileURLs,
        newFileURLs,
        userID,
    )
}
```

### 3. Entity Deletion Flow

```go
// When deleting entity
func DeleteProduct(ctx context.Context, productID int32, userID int32) error {
    // Remove all file references first
    err := helper.RemoveEntityFileReferences(ctx, "product", productID, &userID)
    if err != nil {
        return err
    }
    
    // Then delete the entity
    return productService.Delete(ctx, productID)
}
```

### 4. Cleanup Strategy

```go
// Recommended cleanup schedule
// - Temporary files: every 6 hours, files older than 24 hours
// - Orphaned files: daily at 2 AM, grace period 7 days
// - Mark orphaned: every hour

// Use cron jobs or scheduled tasks
func setupCleanupJobs() {
    // Cleanup temporary files every 6 hours
    cron.AddFunc("0 */6 * * *", func() {
        ctx := context.Background()
        result, err := fileService.CleanupTemporaryFiles(ctx, 24*time.Hour)
        if err != nil {
            log.Printf("Temporary cleanup failed: %v", err)
        } else {
            log.Printf("Cleaned up %d temporary files", result.FilesDeleted)
        }
    })
    
    // Cleanup orphaned files daily at 2 AM
    cron.AddFunc("0 2 * * *", func() {
        ctx := context.Background()
        result, err := fileService.CleanupOrphanedFiles(ctx, 7*24*time.Hour)
        if err != nil {
            log.Printf("Orphaned cleanup failed: %v", err)
        } else {
            log.Printf("Cleaned up %d orphaned files", result.FilesDeleted)
        }
    })
    
    // Mark orphaned files every hour
    cron.AddFunc("0 * * * *", func() {
        ctx := context.Background()
        count, err := fileService.MarkOrphanedFiles(ctx)
        if err != nil {
            log.Printf("Mark orphaned failed: %v", err)
        } else {
            log.Printf("Marked %d files as orphaned", count)
        }
    })
}
```

## Troubleshooting

### 1. Common Issues

#### File không được track
- Kiểm tra middleware có được apply đúng không
- Kiểm tra event publisher có hoạt động không
- Xem log để tìm lỗi

#### Reference count không chính xác
- Chạy manual update reference count
- Kiểm tra event handlers có hoạt động đúng không

#### Cleanup không hoạt động
- Kiểm tra cron jobs có được setup không
- Kiểm tra API key cho cleanup endpoints
- Xem audit logs để trace cleanup operations

### 2. Debugging Commands

```bash
# Check file statistics
curl "http://localhost:8080/api/admin/files/statistics" \
  -H "X-Cleanup-API-Key: your-api-key"

# Check specific file
curl "http://localhost:8080/api/admin/files/{publicId}" \
  -H "X-Cleanup-API-Key: your-api-key"

# Check audit logs for specific file
curl "http://localhost:8080/api/admin/files/audit-logs?file_id=123" \
  -H "X-Cleanup-API-Key: your-api-key"

# Dry run cleanup to see what would be deleted
curl -X POST "http://localhost:8080/api/admin/files/cleanup/temporary?dry_run=true" \
  -H "X-Cleanup-API-Key: your-api-key"
```

### 3. Performance Monitoring

```sql
-- Check file statistics
SELECT 
    COUNT(*) as total_files,
    COUNT(*) FILTER (WHERE is_temporary = true) as temporary_files,
    COUNT(*) FILTER (WHERE is_orphaned = true) as orphaned_files,
    COUNT(*) FILTER (WHERE reference_count = 0) as zero_ref_files,
    SUM(file_size) as total_size
FROM file_uploads 
WHERE deleted_at IS NULL;

-- Check reference distribution
SELECT 
    reference_count,
    COUNT(*) as file_count
FROM file_uploads 
WHERE deleted_at IS NULL
GROUP BY reference_count
ORDER BY reference_count;

-- Check cleanup job history
SELECT 
    job_type,
    status,
    files_processed,
    files_deleted,
    files_failed,
    created_at
FROM file_cleanup_jobs 
ORDER BY created_at DESC 
LIMIT 20;
```

## Security Considerations

1. **API Key Protection**: Cleanup API key phải được bảo vệ cẩn thận
2. **Access Control**: Chỉ admin mới có quyền truy cập cleanup endpoints
3. **Audit Trail**: Tất cả operations đều được ghi log
4. **Dry Run**: Luôn test với dry run trước khi cleanup thực tế
5. **Backup**: Backup database trước khi chạy cleanup lớn

## Migration từ hệ thống cũ

```go
// Script để migrate existing files
func migrateExistingFiles(ctx context.Context) error {
    // 1. Scan existing entities for file URLs
    products, err := productService.GetAll(ctx)
    if err != nil {
        return err
    }
    
    for _, product := range products {
        // Extract file URLs
        fileURLs := extractor.ExtractFromProductData(product)
        
        for _, url := range fileURLs {
            // Create file record if not exists
            publicID := helper.extractPublicIDFromURL(url)
            
            _, err := fileService.GetFileUploadByPublicID(ctx, publicID)
            if err != nil {
                // File not tracked, create record
                fileRecord, err := helper.TrackUploadedFile(
                    ctx,
                    publicID,
                    url,
                    filepath.Base(url),
                    "image", // default type
                    0, // unknown size
                    nil, // unknown user
                    "product",
                    product.ID,
                    nil,
                    map[string]interface{}{"migrated": true},
                )
                if err != nil {
                    log.Printf("Failed to migrate file %s: %v", url, err)
                }
            }
        }
    }
    
    return nil
}
```