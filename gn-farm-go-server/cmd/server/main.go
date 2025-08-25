// Main package cho GN-Farm Go server
// Entry point của ứng dụng Go backend
package main

import (
	"gn-farm-go-server/internal/initialize" // Package khởi tạo các thành phần hệ thống
	"log"

	// Swagger dependencies cho tài liệu API
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// Các annotation cho Swagger API documentation
// @title           API Documentation GN-FARM - Tài liệu API GN-FARM
// @version         1.0.0 - Phiên bản hiện tại
// @description     Hệ thống quản lý nông trại GN-FARM Backend API
// @termsOfService  github.com/anonystick/go-ecommerce-backend-go

// @contact.name   TEAM TIPSGO - Đội phát triển
// @contact.url    github.com/anonystick/go-ecommerce-backend-go
// @contact.email  tipsgo@gmail.com

// @license.name  Apache 2.0 - Giấy phép sử dụng
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:8002 - Địa chỉ server local
// @BasePath  /v1 - Base path cho tất cả API endpoints
// @schema http - Sử dụng HTTP protocol
// Hàm main - điểm khởi đầu của ứng dụng Go server
func main() {
	// Khởi tạo router và các thành phần hệ thống (database, redis, logging, etc.)
	r := initialize.Run()
	log.Println("🚀 Hot reload: server started - hot reloading is working!")

	// Cấu hình Swagger UI để xem tài liệu API trên trình duyệt
	// Truy cập tại: http://localhost:8002/swagger/index.html
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Khởi động HTTP server trên port 8002
	// Server sẽ lắng nghe các request HTTP trên localhost:8002
	r.Run(":8002")
}
