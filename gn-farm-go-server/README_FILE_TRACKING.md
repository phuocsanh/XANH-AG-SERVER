# GN Farm File Tracking System

## 🎯 Tổng quan

Hệ thống File Tracking cho GN Farm được thiết kế để giải quyết vấn đề quản lý ảnh rác (orphaned images) một cách toàn diện và tự động. Hệ thống này triển khai các best practices trong ngành để đảm bảo hiệu quả, bảo mật và khả năng mở rộng.

### ✨ Tính năng chính

- **🔢 Reference Counting**: Theo dõi số lượng tham chiếu đến mỗi file real-time
- **⚡ Event-driven Architecture**: Xử lý cleanup tự động dựa trên sự kiện
- **📊 Database Tracking**: Audit trail đầy đủ cho mọi thao tác file
- **⏰ Scheduled Cleanup**: Dọn dẹp định kỳ với nhiều chiến lược
- **🛡️ Safety Features**: Dry-run, grace period, backup recommendations
- **📈 Monitoring**: Dashboard và metrics chi tiết

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────┐
│                        File Tracking System                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │   Upload    │  │ Reference   │  │   Event     │  │Cleanup  │ │
│  │  Tracking   │  │  Counting   │  │  System     │  │Scheduler│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
│         │                 │                 │             │     │
│         └─────────────────┼─────────────────┼─────────────┘     │
│                           │                 │                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Database Layer                          │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐ │ │
│  │  │file_uploads │ │file_references│ │file_audit_logs│ │cleanup │ │ │
│  │  │             │ │             │ │             │ │ _jobs  │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   External Services                        │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐ │ │
│  │  │  Cloudinary │ │     S3      │ │    Redis    │ │  Cron  │ │ │
│  │  │   Storage   │ │   Storage   │ │  Pub/Sub    │ │  Jobs  │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Database Setup

```bash
# Chạy migration để tạo các bảng cần thiết
psql -d gn_farm_db -f sql/schema/20241201001_file_tracking_system.sql

# Tạo SQLC queries
sqlc generate
```

### 2. Environment Configuration

```bash
# Copy và cấu hình environment variables
cp .env.example .env

# Cấu hình các biến sau trong .env:
REDIS_URL=redis://localhost:6379
FILE_EVENTS_CHANNEL_PREFIX=file_events
CLEANUP_API_KEY=your-secure-api-key-here
TEMPORARY_FILE_MAX_AGE=24h
ORPHANED_FILE_GRACE_PERIOD=168h
CLEANUP_INTERVAL=6h
FILE_TRACKING_ENABLED=true
FILE_EVENTS_ENABLED=true
AUTO_CLEANUP_ENABLED=false
```

### 3. Code Integration

```go
// main.go
package main

import (
    "context"
    "log"
    
    "github.com/gn-farm-go-server/internal/config"
    "github.com/gn-farm-go-server/internal/routers"
)

func main() {
    // ... existing setup ...
    
    // Setup File Tracking System
    fileTrackingConfig := config.LoadFileTrackingConfigFromEnv()
    
    if err := config.ValidateFileTrackingConfig(fileTrackingConfig); err != nil {
        log.Fatal("Invalid file tracking configuration:", err)
    }
    
    deps, err := config.SetupFileTrackingDependencies(
        fileTrackingConfig,
        db, sqlDB, uploadService, redisClient,
    )
    if err != nil {
        log.Fatal("Failed to setup file tracking:", err)
    }
    
    ctx := context.Background()
    if err := config.StartFileTrackingServices(ctx, fileTrackingConfig, deps); err != nil {
        log.Fatal("Failed to start file tracking services:", err)
    }
    
    // Setup routes with file tracking
    routeConfig := router.FileTrackingRouteConfig{
        EnableWebhooks:    true,
        EnableCronJobs:    true,
        EnableAdminRoutes: true,
        EnableMiddleware:  true,
        CleanupAPIKey:     fileTrackingConfig.Cleanup.API.APIKey,
    }
    
    router.SetupFileTrackingWithConfig(
        ginRouter, routeConfig, deps.FileTrackingHandler,
        deps.FileTrackingMiddleware, deps.CleanupMiddleware,
        deps.UploadMiddleware, deps.FileService,
        deps.CleanupScheduler,
    )
    
    // ... start server ...
}
```

## 📋 Các thành phần đã triển khai

### ✅ Database Layer
- [x] **Migration Script** (`sql/schema/20241201001_file_tracking_system.sql`)
  - Bảng `file_uploads`: Lưu trữ thông tin file và reference count
  - Bảng `file_references`: Theo dõi các entity tham chiếu đến file
  - Bảng `file_audit_logs`: Ghi lại audit trail
  - Bảng `file_cleanup_jobs`: Theo dõi các tác vụ dọn dẹp
  - Indexes và triggers tối ưu hiệu suất

- [x] **SQLC Queries** (`sql/queries/file_tracking.sql`)
  - CRUD operations cho tất cả bảng
  - Queries tối ưu cho cleanup và statistics
  - Batch operations cho hiệu suất cao

### ✅ Service Layer
- [x] **Core Service** (`internal/service/file_tracking/service.go`)
  - Interface `FileTrackingService` với đầy đủ methods
  - Structs cho parameters và responses
  - Constants và enums cho event types

- [x] **Service Implementation** (`internal/service/file_tracking/file_tracking_service.go`)
  - Triển khai đầy đủ `FileTrackingService`
  - Reference counting logic
  - Cleanup operations với safety checks
  - Audit logging
  - Batch operations

- [x] **Event System** (`internal/service/file_tracking/event_publisher.go`)
  - Redis Pub/Sub event publisher
  - Event consumer với configurable handlers
  - Built-in handlers cho common events
  - Cleanup scheduler với cron jobs

- [x] **Helper Functions** (`internal/service/file_tracking/helpers.go`)
  - `FileTrackingHelper` cho integration dễ dàng
  - URL extractors cho các entity types
  - Validation functions
  - Utility functions cho file operations

### ✅ HTTP Layer
- [x] **Middleware** (`internal/service/file_tracking/middleware.go`)
  - `FileTrackingMiddleware`: Tự động track file changes
  - `FileUploadMiddleware`: Track file uploads
  - `CleanupMiddleware`: Bảo vệ cleanup endpoints

- [x] **HTTP Handlers** (`internal/service/file_tracking/file_tracking_handler.go`)
  - Admin APIs cho statistics và monitoring
  - Cleanup APIs với dry-run support
  - File management APIs
  - Health check endpoints

- [x] **Route Configuration** (`internal/service/file_tracking/file_tracking_routes.go`)
  - Complete route setup với middleware integration
  - Webhook handlers cho Cloudinary/S3
  - Cron job endpoints
  - Security với API key authentication

### ✅ Configuration
- [x] **Configuration Management** (`internal/service/file_tracking/file_tracking_config.go`)
  - Comprehensive config structure
  - Environment variable loading
  - Dependency injection setup
  - Service lifecycle management
  - Configuration validation

### ✅ Documentation
- [x] **Technical Documentation** (`docs/FILE_TRACKING_SYSTEM.md`)
  - Detailed architecture explanation
  - API documentation
  - Usage examples
  - Best practices
  - Troubleshooting guide

- [x] **README** (this file)
  - Quick start guide
  - Implementation checklist
  - Deployment instructions

## 🔧 Triển khai Production

### 1. Pre-deployment Checklist

```bash
# ✅ Database migration
psql -d production_db -f sql/schema/20241201001_file_tracking_system.sql

# ✅ Generate SQLC code
sqlc generate

# ✅ Environment variables
source .env.production

# ✅ Redis connection
redis-cli ping

# ✅ Build application
go build -o gn-farm-server ./cmd/server

# ✅ Run tests
go test ./internal/service/file_tracking/...
```

### 2. Migration từ hệ thống cũ

```go
// Chạy script migration để track existing files
func migrateExistingFiles() {
    // 1. Scan tất cả entities có file URLs
    // 2. Tạo file records cho files chưa được track
    // 3. Tạo references cho existing entities
    // 4. Validate reference counts
}
```

### 3. Monitoring Setup

```bash
# Setup monitoring endpoints
curl "http://localhost:8080/api/admin/files/health" \
  -H "X-Cleanup-API-Key: your-api-key"

# Setup alerting cho:
# - High number of orphaned files
# - Failed cleanup jobs
# - Storage usage thresholds
# - Event processing delays
```

### 4. Backup Strategy

```bash
# Backup database trước khi cleanup
pg_dump -t file_uploads -t file_references -t file_audit_logs production_db > backup.sql

# Backup file storage
# Cloudinary: Export via API
# S3: aws s3 sync s3://bucket ./backup/
```

## 📊 Monitoring và Maintenance

### Daily Operations

```bash
# Check system health
curl "http://localhost:8080/api/admin/files/health"

# View statistics
curl "http://localhost:8080/api/admin/files/statistics"

# Check recent cleanup jobs
curl "http://localhost:8080/api/admin/files/audit-logs?limit=20"
```

### Weekly Maintenance

```bash
# Manual cleanup với dry-run
curl -X POST "http://localhost:8080/api/admin/files/cleanup/orphaned?dry_run=true&grace_period=168h"

# Review audit logs
curl "http://localhost:8080/api/admin/files/audit-logs?action=cleanup&limit=100"

# Check storage usage trends
# Monitor database size growth
# Review error logs
```

### Monthly Review

- Analyze cleanup effectiveness
- Review storage costs
- Update grace periods if needed
- Performance optimization
- Security audit

## 🛡️ Security Considerations

1. **API Key Management**
   - Rotate cleanup API keys regularly
   - Use different keys for different environments
   - Monitor API key usage

2. **Access Control**
   - Restrict admin endpoints to authorized users
   - Implement rate limiting
   - Log all administrative actions

3. **Data Protection**
   - Encrypt sensitive file metadata
   - Secure audit log storage
   - Implement data retention policies

4. **Operational Security**
   - Always use dry-run for large cleanups
   - Backup before major operations
   - Monitor for unusual activity

## 🔄 Rollback Plan

Nếu cần rollback hệ thống:

1. **Disable File Tracking**
   ```bash
   export FILE_TRACKING_ENABLED=false
   export FILE_EVENTS_ENABLED=false
   export AUTO_CLEANUP_ENABLED=false
   ```

2. **Remove Middleware**
   ```go
   // Comment out file tracking middleware
   // api.Use(fileTrackingMiddleware.TrackFileChanges())
   ```

3. **Preserve Data**
   ```sql
   -- Backup tracking data
   CREATE TABLE file_uploads_backup AS SELECT * FROM file_uploads;
   CREATE TABLE file_references_backup AS SELECT * FROM file_references;
   ```

4. **Gradual Removal**
   - Remove routes first
   - Then remove middleware
   - Finally remove database tables (after confirmation)

## 📞 Support

Nếu gặp vấn đề:

1. **Check Logs**
   - Application logs
   - Database logs
   - Redis logs

2. **Health Checks**
   - `/api/admin/files/health`
   - Database connectivity
   - Redis connectivity

3. **Debug Tools**
   - Dry-run cleanup operations
   - Audit log analysis
   - Statistics monitoring

4. **Documentation**
   - `docs/FILE_TRACKING_SYSTEM.md` - Technical details
   - API documentation in handlers
   - Code comments

## 🎉 Kết luận

Hệ thống File Tracking đã được thiết kế và triển khai hoàn chỉnh với:

- ✅ **Reference Counting** cho real-time cleanup
- ✅ **Event-driven Architecture** với Redis Pub/Sub
- ✅ **Database Tracking** với audit trail đầy đủ
- ✅ **Scheduled Cleanup** với nhiều chiến lược
- ✅ **Safety Features** và monitoring
- ✅ **Production-ready** với documentation đầy đủ

Hệ thống này sẽ giải quyết triệt để vấn đề ảnh rác trong ứng dụng GN Farm và cung cấp nền tảng vững chắc cho việc quản lý file trong tương lai.

---

**Tác giả**: AI Assistant  
**Ngày tạo**: December 2024  
**Phiên bản**: 1.0.0  
**Trạng thái**: Production Ready ✅