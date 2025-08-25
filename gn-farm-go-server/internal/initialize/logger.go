//####################################################################
// LOGGER INITIALIZATION - KHỞI TẠO HỆ THỐNG LOGGING
// Package này chịu trách nhiệm khởi tạo logger cho toàn bộ ứng dụng
// 
// Chức năng chính:
// - Khởi tạo Zap logger với cấu hình từ config file
// - Thiết lập structured logging cho ứng dụng
// - Cấu hình log levels, output format, và file rotation
// - Lưu logger instance vào global variable
//
// Logger sử dụng Uber Zap framework cho:
// - High performance structured logging
// - JSON format cho dễ parse và analyze
// - Log rotation và archive management
// - Multiple output destinations (console + file)
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

package initialize

import (
	"gn-farm-go-server/global"
	"gn-farm-go-server/pkg/logger"
)

// ===== KHỞI TẠO LOGGER HỆ THỐNG =====
// InitLogger khởi tạo Zap logger với cấu hình từ config file
// Logger được sử dụng cho tất cả logging operations trong ứng dụng
func InitLogger() {
	// Tạo logger instance với cấu hình từ global config
	// Bao gồm: log level, output format, file rotation, etc.
	global.Logger = logger.NewLogger(global.Config.Logger)
}
