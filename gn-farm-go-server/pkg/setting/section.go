// Package setting - Chứa các struct để mapping cấu hình từ YAML files
// Sử dụng Viper để đọc config từ local.yaml, production.yaml, test.yaml
package setting

// Config - Cấu trúc chính chứa tất cả cấu hình của ứng dụng
// Mapping với các section trong YAML file qua mapstructure tags
type Config struct {
	// Server - Cấu hình HTTP server (port, mode)
	Server ServerSetting `mapstructure:"server"`
	// Postgres - Cấu hình kết nối PostgreSQL database
	Postgres PostgresSetting `mapstructure:"postgres"`
	// Logger - Cấu hình hệ thống logging
	Logger LoggerSetting `mapstructure:"logger"`
	// Redis - Cấu hình kết nối Redis cache
	Redis  RedisSetting  `mapstructure:"redis"`
	// JWT - Cấu hình JSON Web Token cho authentication
	JWT    JWTSetting    `mapstructure:"jwt"`
}

// ServerSetting - Cấu hình cho HTTP server
type ServerSetting struct {
	// Port - Cổng để chạy HTTP server (ví dụ: 8082)
	Port int    `mapstructure:"port"`
	// Mode - Chế độ chạy: "dev", "prod", "test"
	Mode string `mapstructure:"mode"`
}

// RedisSetting - Cấu hình kết nối Redis cho caching và session
type RedisSetting struct {
	// Host - Địa chỉ Redis server (ví dụ: localhost, 127.0.0.1)
	Host     string `mapstructure:"host"`
	// Port - Cổng Redis (mặc định: 6379)
	Port     int    `mapstructure:"port"`
	// Password - Mật khẩu Redis (có thể để trống nếu không có)
	Password string `mapstructure:"password"`
	// Database - Số database Redis (0-15, mặc định: 0)
	Database int    `mapstructure:"database"`
}
type PostgresSetting struct {
	Host string `mapstructure:"host"`
	Port int    `mapstructure:"port"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
	Dbname string `mapstructure:"dbname"`
	MaxIdleConns int `mapstructure:"maxIdleConns"`
	MaxOpenConns int `mapstructure:"maxOpenConns"`
	ConnMaxLifetime int `mapstructure:"connMaxLifetime"`
}


type LoggerSetting struct {
	Log_level     string `mapstructure:"log_level"`
	File_log_name string `mapstructure:"file_log_name"`
	Max_backups   int    `mapstructure:"max_backups"`
	Max_age       int    `mapstructure:"max_age"`
	Max_size      int    `mapstructure:"max_size"`
	Compress      bool   `mapstructure:"compress"`
}

// JWT Settings
type JWTSetting struct {
	TOKEN_HOUR_LIFESPAN uint   `mapstructure:"TOKEN_HOUR_LIFESPAN"`
	API_SECRET_KEY      string `mapstructure:"API_SECRET_KEY"`
	JWT_EXPIRATION      string `mapstructure:"JWT_EXPIRATION"`
}
