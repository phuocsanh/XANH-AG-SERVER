//####################################################################
// POSTGRESQL RAW CONNECTION INITIALIZATION - KHỞI TẠO KẾT NỐI POSTGRESQL THẦ
// Package này chịu trách nhiệm khởi tạo raw SQL connection tới PostgreSQL
// 
// Chức năng chính:
// - Thiết lập raw SQL connection (không qua GORM)
// - Sử dụng cho SQLC generated code và raw queries
// - Cấu hình connection pool cho performance tối ưu
// - Hỗ trợ các operations cần raw SQL access
//
// Khác biệt với postgres.go:
// - postgres.go: Sử dụng GORM ORM cho object mapping
// - postgresc.go: Sử dụng raw SQL cho SQLC và performance queries
//
// Sử dụng cho:
// - SQLC generated code execution
// - Complex raw queries và stored procedures
// - High performance database operations
// - Custom SQL scripts và migrations
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

package initialize

import (
	"database/sql"
	"fmt"
	"time"

	"gn-farm-go-server/global"
	"gn-farm-go-server/internal/common"

	_ "github.com/lib/pq"
)

// ===== KHỞI TẠO RAW POSTGRESQL CONNECTION =====
// InitPostgresC khởi tạo raw SQL connection tới PostgreSQL (không qua GORM)
// Connection này được sử dụng cho SQLC generated code và raw queries
func InitPostgresC() {
	p := global.Config.Postgres
	
	// ===== XÂY DỰNG DATA SOURCE NAME (DSN) =====
	// Tạo connection string cho raw SQL driver
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%d sslmode=disable TimeZone=Asia/Ho_Chi_Minh",
		p.Host, p.Username, p.Password, p.Dbname, p.Port)
	
	// ===== Mở RAW SQL CONNECTION =====
	// Sử dụng database/sql package thay vì GORM
	db, err := sql.Open("postgres", dsn)
	common.CheckErrorPanic(err, "Failed to initialize PostgreSQL raw connection")

	global.Logger.Info("PostgreSQL Raw Connection Initialized Successfully")
	global.Pgdbc = db  // Lưu raw connection vào global variable

	// ===== CẤU HÌNH CONNECTION POOL =====
	setPoolC()
}

// ===== CẤU HÌNH CONNECTION POOL CHO RAW CONNECTION =====
// setPoolC thiết lập các tham số connection pool cho raw PostgreSQL connection
// Pool settings giúp tối ưu performance và quản lý resources
func setPoolC() {
	p := global.Config.Postgres
	sqlDb := global.Pgdbc
	
	// ===== CẤU HÌNH CÁC THAM SỐ POOL =====
	// Số lượng connection idle tối đa trong pool
	sqlDb.SetMaxIdleConns(p.MaxIdleConns)
	
	// Số lượng connection mở tối đa đồng thời
	sqlDb.SetMaxOpenConns(p.MaxOpenConns)
	
	// Thời gian sống tối đa của một connection
	sqlDb.SetConnMaxLifetime(time.Duration(p.ConnMaxLifetime) * time.Second)
} 