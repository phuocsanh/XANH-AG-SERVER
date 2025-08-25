//####################################################################
// POSTGRESQL INITIALIZATION - KHỞI TẠO KẾT NỐI POSTGRESQL
// Package này chịu trách nhiệm khởi tạo kết nối PostgreSQL cho ứng dụng
// 
// Chức năng chính:
// - Thiết lập connection tới PostgreSQL database
// - Cấu hình connection pool cho performance tối ưu
// - Xử lý lỗi và logging khi khởi tạo
// - Lưu trữ connection vào global variables
//
// Sử dụng GORM ORM framework cho:
// - Object-Relational Mapping
// - Query builder và migration
// - Connection pooling và transaction management
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

package initialize

import (
	"fmt"
	"time"

	"gn-farm-go-server/global"
	"gn-farm-go-server/internal/common"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// ===== KHỞI TẠO KẾT NỐI POSTGRESQL CHÍNH =====
// InitPostgres khởi tạo kết nối tới PostgreSQL database sử dụng GORM
// Function này được gọi khi start server để thiết lập database connection
func InitPostgres() {
	p := global.Config.Postgres
	
	// ===== XÂY DỰNG DATA SOURCE NAME (DSN) =====
	// Tạo connection string với các thông tin từ config
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable TimeZone=Asia/Ho_Chi_Minh",
		p.Host, p.Port, p.Username, p.Password, p.Dbname)
	
	// ===== Mở KẾT NỐI VỚI GORM =====
	// Sử dụng GORM để kết nối PostgreSQL với các tính năng ORM
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		SkipDefaultTransaction: false,  // Giữ lại auto-transaction cho data consistency
	})
	common.CheckErrorPanic(err, "Failed to initialize PostgreSQL")  // Kiểm tra lỗi và panic nếu thất bại

	global.Logger.Info("PostgreSQL Initialized Successfully")
	global.Pgdb = db  // Lưu connection vào global variable để sử dụng toàn ứng dụng

	// ===== CẤU HÌNH CONNECTION POOL =====
	// Thiết lập các tham số cho connection pool để tối ưu performance
	setPool()
}

// ===== CẤU HÌNH CONNECTION POOL CHI TIẾT =====
// setPool thiết lập các tham số connection pool cho PostgreSQL
// Connection pool giúp quản lý và tái sử dụng các kết nối database hiệu quả
func setPool() {
	p := global.Config.Postgres
	
	// Lấy raw SQL database instance từ GORM
	sqlDb, err := global.Pgdb.DB()
	common.CheckErrorPanic(err, "Failed to get SQL DB from GORM")

	// ===== CẤU HÌNH CÁC THAM SỐ POOL =====
	// Thời gian tối đa một connection có thể idle (không sử dụng)
	sqlDb.SetConnMaxIdleTime(time.Duration(p.MaxIdleConns) * time.Second)
	
	// Số lượng connection tối đa có thể mở đồng thời
	sqlDb.SetMaxOpenConns(p.MaxOpenConns)
	
	// Thời gian sống tối đa của một connection trước khi bị đóng
	sqlDb.SetConnMaxLifetime(time.Duration(p.ConnMaxLifetime) * time.Second)
} 