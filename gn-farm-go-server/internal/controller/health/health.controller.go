//####################################################################
// HEALTH CHECK CONTROLLER - CONTROLLER KIỂM TRA SỨC KHỊE HỆ THỐNG
// Package này chứa các controller kiểm tra sức khỏe và trạng thái của hệ thống
// 
// Chức năng chính:
// - Health Check: Kiểm tra tổng thể trạng thái hệ thống
// - Readiness Check: Kiểm tra sẵn sàng phục vụ requests 
// - Liveness Check: Kiểm tra ứng dụng còn hoạt động
// - Database Health: Kiểm tra kết nối PostgreSQL
// - Redis Health: Kiểm tra kết nối Redis cache
//
// Sử dụng cho:
// - Container orchestration (Kubernetes health probes)
// - Load balancer health checks
// - Monitoring và alerting systems
// - DevOps và infrastructure monitoring
// - API status dashboard
//
// Endpoints:
// - GET /health: Tổng quan trạng thái hệ thống
// - GET /ready: Kiểm tra sẵn sàng nhận traffic
// - GET /live: Kiểm tra ứng dụng còn sống
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

// Package health chứa các controller kiểm tra sức khỏe và trạng thái của hệ thống
// Sử dụng cho monitoring, load balancer health checks, và container orchestration
package health

import (
	"context"  // Context cho các operations có timeout
	"net/http" // HTTP status codes
	"time"     // Time operations và duration tracking

	"gn-farm-go-server/global"       // Global variables (database, redis connections)
	"gn-farm-go-server/pkg/response" // Response utilities

	"github.com/gin-gonic/gin" // Gin web framework
)

// Health - Global instance của health controller (singleton pattern)
var Health = new(healthController)

// healthController - Controller xử lý các endpoint liên quan đến sức khỏe hệ thống
type healthController struct{}

// HealthStatus - Struct đại diện cho trạng thái tổng thể của hệ thống
// Chứa thông tin chi tiết về tất cả các dịch vụ và kết nối
type HealthStatus struct {
	Status    string                 `json:"status"`    // Trạng thái tổng thể ("healthy" hoặc "unhealthy")
	Timestamp time.Time              `json:"timestamp"` // Thời điểm kiểm tra
	Version   string                 `json:"version"`   // Phiên bản ứng dụng
	Services  map[string]ServiceInfo `json:"services"`  // Trạng thái của từng dịch vụ (database, redis, etc.)
	Uptime    string                 `json:"uptime"`    // Thời gian hoạt động liên tục
}

// ServiceInfo - Struct chứa thông tin chi tiết của một dịch vụ cụ thể
// Bao gồm trạng thái, thời gian phản hồi, lỗi (nếu có), và chi tiết bổ sung
type ServiceInfo struct {
	Status      string        `json:"status"`        // Trạng thái ("healthy" hoặc "unhealthy")
	ResponseTime string       `json:"response_time"` // Thời gian phản hồi
	Error       string        `json:"error,omitempty"` // Mô tả lỗi nếu có
	Details     interface{}   `json:"details,omitempty"` // Thông tin chi tiết bổ sung (stats, metrics)
}

// startTime - Thời điểm khởi động server, dùng để tính uptime
var startTime = time.Now()

// HealthCheck - Thực hiện kiểm tra sức khỏe tổng thể của hệ thống
// Chức năng:
// - Kiểm tra kết nối database (PostgreSQL)
// - Kiểm tra kết nối Redis
// - Tính toán uptime và trạng thái tổng quát
// - Trả về báo cáo chi tiết về tất cả các dịch vụ
// @Summary      Health check endpoint - Endpoint kiểm tra sức khỏe
// @Description  Trả về trạng thái sức khỏe của dịch vụ và các dependency
// @Tags         health
// @Accept       json
// @Produce      json
// @Success      200  {object}  HealthStatus
// @Failure      503  {object}  HealthStatus
// @Router       /health [get]
func (h *healthController) HealthCheck(ctx *gin.Context) {
	// Khởi tạo struct chứa thông tin sức khỏe ban đầu
	healthStatus := HealthStatus{
		Status:    "healthy",                    // Mặc định là healthy
		Timestamp: time.Now(),                   // Thời điểm hiện tại
		Version:   "1.0.0",                     // Phiên bản ứng dụng
		Services:  make(map[string]ServiceInfo), // Khởi tạo map chứa trạng thái các dịch vụ
		Uptime:    time.Since(startTime).String(), // Tính uptime từ lúc khởi động
	}

	// Kiểm tra kết nối database và lưu kết quả
	dbStatus := h.checkDatabase()
	healthStatus.Services["database"] = dbStatus

	// Kiểm tra kết nối Redis và lưu kết quả
	redisStatus := h.checkRedis()
	healthStatus.Services["redis"] = redisStatus

	// Xác định trạng thái tổng quát dựa trên trạng thái của tất cả dịch vụ
	overallStatus := "healthy"           // Mặc định là healthy
	statusCode := http.StatusOK          // HTTP 200 OK

	// Duyệt qua tất cả dịch vụ để kiểm tra trạng thái
	for _, service := range healthStatus.Services {
		if service.Status != "healthy" {
			overallStatus = "unhealthy"                    // Nếu có 1 dịch vụ unhealthy -> tổng thể unhealthy
			statusCode = http.StatusServiceUnavailable     // HTTP 503 Service Unavailable
			break                                          // Thoát khỏi vòng lặp
		}
	}

	// Cập nhật trạng thái tổng quát
	healthStatus.Status = overallStatus

	// Trả về JSON response với status code tương ứng
	ctx.JSON(statusCode, healthStatus)
}

// ReadinessCheck - Kiểm tra xem dịch vụ có sẵn sàng phục vụ request không
// Chức năng:
// - Kiểm tra các dependency quan trọng (database, redis)
// - Chỉ trả về ready khi tất cả dependency hoạt động bình thường
// - Sử dụng cho Kubernetes readiness probe
// @Summary      Readiness check endpoint - Endpoint kiểm tra sẵn sàng
// @Description  Trả về xem dịch vụ có sẵn sàng phục vụ requests không
// @Tags         health
// @Accept       json
// @Produce      json
// @Success      200  {object}  response.ResponseData
// @Failure      503  {object}  response.ErrorResponseData
// @Router       /ready [get]
func (h *healthController) ReadinessCheck(ctx *gin.Context) {
	// Kiểm tra các dependency quan trọng
	dbStatus := h.checkDatabase()   // Kiểm tra database
	redisStatus := h.checkRedis()   // Kiểm tra Redis

	// Chỉ trả về ready khi cả database và redis đều hoạt động tốt
	if dbStatus.Status == "healthy" && redisStatus.Status == "healthy" {
		// Dịch vụ sẵn sàng phục vụ
		response.SuccessResponse(ctx, response.ErrCodeSuccess, gin.H{
			"status": "ready",
			"timestamp": time.Now(),
		})
	} else {
		// Dịch vụ chưa sẵn sàng do có dependency bị lỗi
		response.ErrorResponse(ctx, response.ErrCodeInternalServerError, "Service not ready")
	}
}

// LivenessCheck - Kiểm tra xem dịch vụ có đang hoạt động không
// Chức năng:
// - Kiểm tra đơn giản xem ứng dụng có responsive không
// - Không phụ thuộc vào các dịch vụ bên ngoài
// - Sử dụng cho Kubernetes liveness probe
// - Luôn trả về success nếu process vẫn đang chạy
// @Summary      Liveness check endpoint - Endpoint kiểm tra sự sống
// @Description  Trả về xem dịch vụ có đang hoạt động không
// @Tags         health
// @Accept       json
// @Produce      json
// @Success      200  {object}  response.ResponseData
// @Router       /live [get]
func (h *healthController) LivenessCheck(ctx *gin.Context) {
	// Trả về thông tin cơ bản về trạng thái sống của ứng dụng
	response.SuccessResponse(ctx, response.ErrCodeSuccess, gin.H{
		"status": "alive",                           // Ứng dụng đang sống
		"timestamp": time.Now(),                     // Thời điểm kiểm tra
		"uptime": time.Since(startTime).String(),    // Thời gian hoạt động liên tục
	})
}

// checkDatabase - Kiểm tra kết nối và trạng thái của PostgreSQL database
// Chức năng:
// - Kiểm tra xem connection pool có được khởi tạo không
// - Thực hiện ping để kiểm tra kết nối thực tế
// - Lấy thống kê connection pool (active, idle connections)
// - Đo thời gian phản hồi
// @return ServiceInfo - Thông tin chi tiết về trạng thái database
func (h *healthController) checkDatabase() ServiceInfo {
	start := time.Now() // Bắt đầu đo thời gian

	// Kiểm tra xem database connection có được khởi tạo không
	if global.Pgdbc == nil {
		return ServiceInfo{
			Status:       "unhealthy",                            // Trạng thái không tốt
			ResponseTime: time.Since(start).String(),             // Thời gian xử lý
			Error:        "Database connection not initialized",  // Lỗi: chưa khởi tạo kết nối
		}
	}

	// Thực hiện ping để kiểm tra kết nối thực tế
	err := global.Pgdbc.Ping()
	responseTime := time.Since(start).String() // Tính thời gian phản hồi

	// Nếu ping thất bại
	if err != nil {
		return ServiceInfo{
			Status:       "unhealthy",   // Trạng thái không tốt
			ResponseTime: responseTime,   // Thời gian phản hồi
			Error:        err.Error(),   // Chi tiết lỗi
		}
	}

	// Lấy thống kê connection pool để monitor hiệu suất
	stats := global.Pgdbc.Stats()

	// Trả về thông tin trạng thái tốt kèm chi tiết
	return ServiceInfo{
		Status:       "healthy",     // Trạng thái tốt
		ResponseTime: responseTime,   // Thời gian phản hồi
		Details: map[string]interface{}{
			"open_connections": stats.OpenConnections, // Số kết nối đang mở
			"in_use":          stats.InUse,          // Số kết nối đang sử dụng
			"idle":            stats.Idle,           // Số kết nối đang idle
		},
	}
}

// checkRedis - Kiểm tra kết nối và trạng thái của Redis server
// Chức năng:
// - Kiểm tra xem Redis client có được khởi tạo không
// - Thực hiện PING command để kiểm tra kết nối thực tế
// - Lấy thống kê connection pool (hits, misses, timeouts)
// - Đo thời gian phản hồi
// @return ServiceInfo - Thông tin chi tiết về trạng thái Redis
func (h *healthController) checkRedis() ServiceInfo {
	start := time.Now() // Bắt đầu đo thời gian

	// Kiểm tra xem Redis client có được khởi tạo không
	if global.Rdb == nil {
		return ServiceInfo{
			Status:       "unhealthy",                        // Trạng thái không tốt
			ResponseTime: time.Since(start).String(),         // Thời gian xử lý
			Error:        "Redis connection not initialized", // Lỗi: chưa khởi tạo kết nối
		}
	}

	// Thực hiện PING command với context để kiểm tra kết nối
	ctx := context.Background()
	pong, err := global.Rdb.Ping(ctx).Result()
	responseTime := time.Since(start).String() // Tính thời gian phản hồi

	// Nếu PING thất bại
	if err != nil {
		return ServiceInfo{
			Status:       "unhealthy",   // Trạng thái không tốt
			ResponseTime: responseTime,   // Thời gian phản hồi
			Error:        err.Error(),   // Chi tiết lỗi
		}
	}

	// Lấy thống kê connection pool để monitor hiệu suất
	poolStats := global.Rdb.PoolStats()

	// Trả về thông tin trạng thái tốt kèm chi tiết
	return ServiceInfo{
		Status:       "healthy",     // Trạng thái tốt
		ResponseTime: responseTime,   // Thời gian phản hồi
		Details: map[string]interface{}{
			"ping_response": pong,        // Kết quả của PING command (thường là "PONG")
			"pool_stats": map[string]interface{}{
				"hits":        poolStats.Hits,        // Số lần sử dụng connection từ pool thành công
				"misses":      poolStats.Misses,      // Số lần phải tạo connection mới
				"timeouts":    poolStats.Timeouts,    // Số lần timeout khi lấy connection
				"total_conns": poolStats.TotalConns,  // Tổng số connection
				"idle_conns":  poolStats.IdleConns,   // Số connection đang idle
			},
		},
	}
}
