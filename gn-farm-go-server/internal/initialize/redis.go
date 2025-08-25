//####################################################################
// REDIS INITIALIZATION - KHỞI TẠO KẾT NỐI REDIS
// Package này chịu trách nhiệm khởi tạo kết nối Redis cho caching và session
// 
// Chức năng chính:
// - Thiết lập Redis client với connection pooling
// - Kiểm tra kết nối Redis với PING command
// - Cấu hình Redis cho caching, session management, rate limiting
// - Cung cấp example functions cho testing Redis operations
//
// Redis được sử dụng cho:
// - Caching API responses và database queries
// - Session storage cho user authentication
// - Rate limiting cho API endpoints
// - Real-time data và pub/sub messaging
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

package initialize

import (
	"context"
	"fmt"

	"gn-farm-go-server/global"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// Context được sử dụng cho tất cả Redis operations
var ctx = context.Background()

// ===== KHỞI TẠO REDIS CLIENT =====
// InitRedis khởi tạo kết nối tới Redis server với connection pooling
// Function này được gọi khi start server để thiết lập Redis cache
func InitRedis() {
	r := global.Config.Redis
	
	// ===== TẠO REDIS CLIENT VỚI CẤU HÌNH =====
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%v", r.Host, r.Port), // Địa chỉ Redis server
		Password: r.Password,                            // Mật khẩu (có thể rỗng nếu không có)
		DB:       r.Database,                            // Số database (mặc định là 0)
		PoolSize: 10,                                    // Kích thước connection pool
	})

	// ===== KIỂM TRA KẾT NỐI =====
	// Thực hiện PING command để kiểm tra Redis server có hoạt động
	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		global.Logger.Error("Redis initialization Error:", zap.Error(err))
	}

	// Lưu Redis client vào global variable để sử dụng toàn ứng dụng
	global.Logger.Info("Initializing Redis Successfully")
	global.Rdb = rdb
	// redisExample() // Gọi hàm example nếu cần test
}

// ===== HÀM VÍ DỤ SỬ DỤNG REDIS =====
// redisExample minh họa cách sử dụng các Redis operations cơ bản
// Function này chỉ dùng cho testing và development
func redisExample() {
	// ===== SET - LƯU DỮU LIỆU VÀO REDIS =====
	err := global.Rdb.Set(ctx, "score", 100, 0).Err() // TTL = 0 nghĩa là không hết hạn
	if err != nil {
		fmt.Println("Error redis setting:", zap.Error(err))
		return
	}

	// ===== GET - LẤY DỮU LIỆU TỪ REDIS =====
	value, err := global.Rdb.Get(ctx, "score").Result()
	if err != nil {
		fmt.Println("Error redis getting:", zap.Error(err))
		return
	}

	// Log kết quả để kiểm tra
	global.Logger.Info("Redis example - value score is::", zap.String("score", value))
}
