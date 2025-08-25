//####################################################################
// LOGGER PACKAGE - HỆ THỐNG LOGGING CHO GN FARM GO SERVER
// Package này cung cấp hệ thống logging có cấu trúc sử dụng Uber Zap
// Hỗ trợ ghi log vào cả console và file với log rotation
//
// Tính năng:
// - Log levels: debug, info, warn, error, fatal, panic
// - Output đồng thời ra console và file
// - Log rotation tự động (theo size, age, backup count)
// - JSON format cho dễ parse và search
// - Caller information và stack trace
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

package logger

import (
	"os"

	"gn-farm-go-server/pkg/setting"

	"github.com/natefinch/lumberjack"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// ===== LOGGER WRAPPER STRUCT =====

// LoggerZap - Wrapper cho Uber Zap logger để thêm các method tiện ích
// Embed *zap.Logger để kế thừa tất cả methods gốc
type LoggerZap struct {
	*zap.Logger  // Embed Zap logger
}

// NewLogger - Tạo một instance LoggerZap mới với cấu hình tùy chỉnh
// @param config setting.LoggerSetting - Cấu hình logger từ file config
// @return *LoggerZap - Logger instance đã cấu hình sẵn sàng sử dụng
func NewLogger(config setting.LoggerSetting) *LoggerZap {
	logLevel := config.Log_level // Ví dụ: "debug", "info", "warn", "error"
	
	// Mapping log level từ string sang zapcore.Level
	// Thứ tự ưu tiên: debug -> info -> warn -> error -> fatal -> panic
	var level zapcore.Level
	switch logLevel {
	case "debug":
		level = zapcore.DebugLevel  // Hiển thị tất cả log (chi tiết nhất)
	case "info":
		level = zapcore.InfoLevel   // Hiển thị info, warn, error
	case "warn":
		level = zapcore.WarnLevel   // Hiển thị warn, error
	case "error":
		level = zapcore.ErrorLevel  // Chỉ hiển thị error
	default:
		level = zapcore.InfoLevel   // Mặc định là info level
	}
	encoder := getEncoderLog()
	hook := lumberjack.Logger{
		Filename:   config.File_log_name, //"./storages/logs/dev.xxx.log", //"/var/log/myapp/foo.log",
		MaxSize:    config.Max_size,      // megabytes
		MaxBackups: config.Max_backups,
		MaxAge:     config.Max_age,  //days
		Compress:   config.Compress, // disabled by default
	}
	core := zapcore.NewCore(
		encoder,
		zapcore.NewMultiWriteSyncer(zapcore.AddSync(os.Stdout), zapcore.AddSync(&hook)),
		level)
	//	logger := zap.New(core, zap.AddCaller())
	return &LoggerZap{zap.New(core, zap.AddCaller(), zap.AddStacktrace(zap.ErrorLevel))}
}

// format logs a message
func getEncoderLog() zapcore.Encoder {
	encodeConfig := zap.NewProductionEncoderConfig()

	// 1716714967.877995 -> 2024-05-26T16:16:07.877+0700
	encodeConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	// ts -> Time
	encodeConfig.TimeKey = "time"
	// from info INFO
	encodeConfig.EncodeLevel = zapcore.CapitalLevelEncoder

	//"caller":"cli/main.log.go:24
	encodeConfig.EncodeCaller = zapcore.ShortCallerEncoder // zao.Ne
	return zapcore.NewJSONEncoder(encodeConfig)

}
