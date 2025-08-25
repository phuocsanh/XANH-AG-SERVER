//####################################################################
// GLOBAL VARIABLES - BIẾN TOÀN CỤC HỆ THỐNG
// Package này chứa tất cả biến global được sử dụng xuyên suốt ứng dụng
// 
// Chức năng chính:
// - Quản lý các singleton instances (Database, Redis, Logger, Kafka)
// - Lưu trữ cấu hình hệ thống từ config files
// - Cung cấp access point cho tất cả shared resources
// - Đảm bảo thread-safe access cho concurrent operations
//
// Các thành phần được quản lý:
// - Config: Cấu hình toàn bộ hệ thống
// - Logger: Zap structured logging
// - Database: PostgreSQL (GORM + Raw SQL)
// - Redis: Cache và session management
// - Kafka: Message queue và event streaming
//
// Lưu ý quan trọng:
// - Các biến này được khởi tạo một lần khi start server
// - Không được modify sau khi khởi tạo
// - Thread-safe cho concurrent access
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

// Package global - Chứa các biến global được sử dụng trong toàn bộ ứng dụng
// Quản lý các instance singleton như database, redis, logger, kafka
package global

import (
	"database/sql"

	"gn-farm-go-server/pkg/logger"
	"gn-farm-go-server/pkg/setting"

	"github.com/redis/go-redis/v9"
	"github.com/segmentio/kafka-go"
	"gorm.io/gorm"
)

// ===== KHAI BÁO CÁC BIẾN GLOBAL HỆ THỐNG =====
// Các biến global được khởi tạo khi start server và sử dụng trong toàn bộ ứng dụng
var (
	// ===== CẤU HÌNH HỆ THỐNG =====
	// Config - Chứa tất cả cấu hình từ file config (database, redis, jwt, etc.)
	// Được tải từ file YAML hoặc environment variables
	// Bao gồm: server settings, database connections, external services
	Config        setting.Config
	
	// ===== HỆ THỐNG LOGGING =====
	// Logger - Instance của Zap logger để ghi log có cấu trúc
	// Sử dụng cho: error logging, request tracking, audit trail
	// Format: JSON structured logs cho dễ parse và analyze
	Logger        *logger.LoggerZap
	
	// ===== REDIS CACHE SERVICE =====
	// Rdb - Client Redis để caching, session management, rate limiting
	// Sử dụng cho: 
	// - API response caching
	// - User session storage
	// - Rate limiting counters
	// - Real-time data và pub/sub messaging
	Rdb           *redis.Client
	
	// ===== POSTGRESQL DATABASE CONNECTIONS =====
	// Pgdb - GORM database instance cho PostgreSQL (ORM operations)
	// Sử dụng cho: 
	// - Object-relational mapping
	// - Model-based database operations
	// - Built-in query builder và migrations
	// - Transaction management với models
	Pgdb   	*gorm.DB
	
	// Pgdbc - Raw SQL database connection cho PostgreSQL (raw queries, transactions)
	// Sử dụng cho:
	// - SQLC generated code execution
	// - Complex raw SQL queries
	// - High performance operations
	// - Custom stored procedures
	Pgdbc  	*sql.DB
	
	// ===== KAFKA MESSAGE QUEUE =====
	// KafkaProducer - Kafka writer để gửi messages đến Kafka topics
	// Sử dụng cho: 
	// - Event streaming giữa microservices
	// - OTP và notification messages
	// - Audit logs và monitoring events
	// - Async processing cho heavy operations
	KafkaProducer *kafka.Writer
)

// ===== TÔNG KẾT CÁC THÀNH PHẦN ĐƯỢC QUẢN LÝ =====
// Danh sách các thành phần được quản lý:
// ✓ Config: Cấu hình hệ thống toàn diện
// ✓ Logger: Structured logging với Zap 
// ✓ Redis: Cache và session storage 
// ✓ PostgreSQL (GORM): ORM-based database operations
// ✓ PostgreSQL (Raw): High-performance SQL operations
// ✓ Kafka: Message streaming và event processing (tùy chọn)
//
// Lưu ý an toàn:
// - Các biến này được khởi tạo một lần trong quá trình start server
// - Không modify hoặc reassign sau khi đã khởi tạo
// - Thread-safe cho concurrent access từ multiple goroutines
// - Sử dụng dependency injection khi có thể thay vì global access
