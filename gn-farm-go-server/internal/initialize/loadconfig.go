//####################################################################
// CONFIGURATION LOADING - TẢI CẤU HÌNH HỆ THỐNG
// Package này chịu trách nhiệm tải cấu hình hệ thống từ nhiều nguồn
// 
// Chức năng chính:
// - Tải cấu hình từ config files (YAML/JSON)
// - Override bằng environment variables
// - Thiết lập default values cho tất cả settings
// - Validation và logging cấu hình
// - Ưu tiên: Environment Variables > Config Files > Default Values
//
// Cấu hình bao gồm:
// - Server settings (host, port, mode)
// - Database connections (PostgreSQL, Redis)
// - External services (Kafka, Cloudinary)
// - Security settings (JWT, encryption)
// - Logging và monitoring configuration
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

package initialize

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"gn-farm-go-server/global"

	"github.com/spf13/viper"
)

// ===== HÀM CHÍNH TẢI CẤU HÌNH =====
// LoadConfig tải cấu hình từ nhiều nguồn với thứ tự ưu tiên:
// 1. Environment variables (cao nhất)
// 2. Config files (trung bình) 
// 3. Default values (thấp nhất)
func LoadConfig() {
	viper := viper.New()

	// ===== THIẾT LẬP GIÁ TRỊ MẶC ĐỊNH =====
	// Đặt các giá trị mặc định cho tất cả cấu hình
	setDefaults(viper)

	// ===== TẢI CẤU HÌNH TỪ FILE =====
	// Tải cấu hình từ file YAML/JSON theo environment
	loadConfigFile(viper)

	// ===== OVERRIDE BẰNG ENVIRONMENT VARIABLES =====
	// Ghi đè cấu hình bằng biến môi trường
	loadEnvironmentVariables(viper)

	// ===== PARSE VÀ LƯU CẤU HÌNH =====
	// Chuyển đổi cấu hình thành struct và lưu vào global variable
	if err := viper.Unmarshal(&global.Config); err != nil {
		panic(fmt.Errorf("unable to decode configuration: %w", err))
	}

	// ===== XÁC THỰC VÀ GHI LOG =====
	// Kiểm tra tính hợp lệ của cấu hình
	validateConfig()

	// Ghi log thông tin cấu hình (ẩn thông tin nhạy cảm)
	logConfiguration()
}

// ===== THIẾT LẬP GIÁ TRỊ MẶC ĐỊNH =====
// setDefaults thiết lập các giá trị mặc định cho tất cả cấu hình
// Đây là fallback khi không có config file hoặc environment variables
func setDefaults(v *viper.Viper) {
	// ===== CẤU HÌNH SERVER MẶC ĐỊNH =====
	v.SetDefault("server.port", 8002)        // Port mặc định cho GN Farm API
	v.SetDefault("server.host", "0.0.0.0")    // Listen trên tất cả interfaces
	v.SetDefault("server.mode", "debug")      // Debug mode cho development

	// ===== CẤU HÌNH DATABASE MẶC ĐỊNH =====
	v.SetDefault("postgres.host", "localhost")     // PostgreSQL host
	v.SetDefault("postgres.port", 5432)            // PostgreSQL standard port
	v.SetDefault("postgres.username", "postgres")  // Default PostgreSQL user
	v.SetDefault("postgres.password", "123456")    // Default password (development only)
	v.SetDefault("postgres.dbname", "GO_GN_FARM")  // GN Farm database name
	v.SetDefault("postgres.sslmode", "disable")    // Disable SSL cho development

	// ===== CẤU HÌNH REDIS MẶC ĐỊNH =====
	v.SetDefault("redis.host", "localhost")  // Redis host
	v.SetDefault("redis.port", 6379)         // Redis standard port
	v.SetDefault("redis.password", "")       // Không có password mặc định
	v.SetDefault("redis.db", 0)              // Sử dụng database 0

	// ===== CẤU HÌNH JWT MẶC ĐỊNH =====
	v.SetDefault("jwt.API_SECRET_KEY", "default-jwt-secret-change-in-production")
}

// ===== TẢI CẤU HÌNH TỪ FILE =====
// loadConfigFile tải cấu hình từ file YAML theo environment
// File config được đặt trong thư mục ./config/ và có tên theo environment
func loadConfigFile(v *viper.Viper) {
	// ===== XÁC ĐỊNH ENVIRONMENT =====
	// Lấy environment từ biến môi trường GO_ENV
	env := os.Getenv("GO_ENV")
	if env == "" {
		env = "local"  // Mặc định là local environment
	}

	// ===== CẤU HÌNH ĐƯỜNG DẪN FILE =====
	v.AddConfigPath("./config/")  // Thư mục chứa config files
	v.SetConfigName(env)          // Tên file theo environment (local.yaml, dev.yaml, prod.yaml)
	v.SetConfigType("yaml")       // Định dạng file YAML

	// ===== ĐỌC FILE CẤU HÌNH =====
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// Không tìm thấy file config - sử dụng default và env vars
			fmt.Printf("Config file not found for environment '%s', using defaults and environment variables\n", env)
		} else {
			// Lỗi khác khi đọc file
			fmt.Printf("Error reading config file: %v\n", err)
		}
	} else {
		// Thành công - hiển thị đường dẫn file đang sử dụng
		fmt.Printf("Using config file: %s\n", v.ConfigFileUsed())
	}
}

// ===== GHI ĐÈ BẰNG ENVIRONMENT VARIABLES =====
// loadEnvironmentVariables ghi đè cấu hình bằng biến môi trường
// Đây là cách an toàn nhất để set cấu hình trong production
func loadEnvironmentVariables(v *viper.Viper) {
	// ===== TỰ ĐỘNG BIND ENVIRONMENT VARIABLES =====
	v.AutomaticEnv()  // Tự động bind env vars
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))  // Chuyển dấu chấm thành gạch dưới

	// ===== MANUAL BINDING CHO KIỂM SOÁT TỐT HƠN =====
	// Ánh xạ các environment variables với config keys
	envMappings := map[string]string{
		// Server configuration
		"GO_ENV":                    "server.mode",        // Environment mode
		"GO_SERVER_PORT":           "server.port",        // Server port
		"GO_SERVER_HOST":           "server.host",        // Server host

		// PostgreSQL configuration  
		"POSTGRES_HOST":            "postgres.host",      // Database host
		"POSTGRES_PORT":            "postgres.port",      // Database port
		"POSTGRES_USER":            "postgres.username",  // Database username
		"POSTGRES_PASSWORD":        "postgres.password",  // Database password
		"POSTGRES_DB":              "postgres.dbname",    // Database name
		"POSTGRES_SSL_MODE":        "postgres.sslmode",   // SSL mode

		// Redis configuration
		"REDIS_HOST":               "redis.host",         // Redis host
		"REDIS_PORT":               "redis.port",         // Redis port
		"REDIS_PASSWORD":           "redis.password",     // Redis password
		"REDIS_DB":                 "redis.db",           // Redis database number

		// JWT configuration
		"JWT_SECRET":               "jwt.API_SECRET_KEY",  // JWT secret key

		// Email service configuration
		"SENDGRID_API_KEY":         "email.sendgrid.api_key",  // SendGrid API key
		"SENDER_EMAIL":             "email.sender.email",      // Sender email address
	}

	// ===== XỬ LÝ VÀ SET GIÁ TRỊ =====
	for envVar, configKey := range envMappings {
		if value := os.Getenv(envVar); value != "" {
			// Xử lý chuyển đổi kiểu dữ liệu cho các key cụ thể
			switch configKey {
			case "server.port", "postgres.port", "redis.port", "redis.db":
				// Chuyển đổi thành integer cho các port và db number
				if intVal, err := strconv.Atoi(value); err == nil {
					v.Set(configKey, intVal)
				}
			default:
				// Giữ nguyên string cho các config khác
				v.Set(configKey, value)
			}
		}
	}
}

// ===== XÁC THỰC CẤU HÌNH =====
// validateConfig kiểm tra tính hợp lệ của các cấu hình bắt buộc
// Đảm bảo hệ thống có đủ thông tin để chạy ổn định
func validateConfig() {
	// ===== KIỂM TRA JWT SECRET =====
	// Cảnh báo nếu vẫn sử dụng JWT secret mặc định
	if global.Config.JWT.API_SECRET_KEY == "default-jwt-secret-change-in-production" {
		fmt.Println("WARNING: Using default JWT secret. Please change it in production!")
	}

	// ===== KIỂM TRA CẤU HÌNH DATABASE BẮT BUỘC =====
	// PostgreSQL host là bắt buộc
	if global.Config.Postgres.Host == "" {
		panic("postgres host is required")
	}

	// PostgreSQL username là bắt buộc
	if global.Config.Postgres.Username == "" {
		panic("postgres username is required")
	}

	// PostgreSQL database name là bắt buộc
	if global.Config.Postgres.Dbname == "" {
		panic("postgres database name is required")
	}
}

// ===== GHI LOG THÔNG TIN CẤU HÌNH =====
// logConfiguration ghi log thông tin cấu hình quan trọng (ẩn thông tin nhạy cảm)
// Giúp debug và xác nhận cấu hình đang được sử dụng
func logConfiguration() {
	fmt.Println("=== Configuration Loaded ===")
	fmt.Printf("Environment: %s\n", os.Getenv("GO_ENV"))           // Hiển thị environment hiện tại
	fmt.Printf("Server Port: %d\n", global.Config.Server.Port)       // Port server sẽ lắng nghe
	fmt.Printf("Server Mode: %s\n", global.Config.Server.Mode)       // Chế độ server (debug/release)
	fmt.Printf("Database Host: %s\n", global.Config.Postgres.Host)   // Host của PostgreSQL
	fmt.Printf("Database Name: %s\n", global.Config.Postgres.Dbname) // Tên database
	fmt.Printf("Redis Host: %s\n", global.Config.Redis.Host)         // Host của Redis
	fmt.Println("============================")
	// Lưu ý: Không ghi log password và các thông tin nhạy cảm
}
