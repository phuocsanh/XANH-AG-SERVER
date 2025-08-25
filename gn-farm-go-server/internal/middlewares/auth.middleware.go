// Package middlewares - Chứa các middleware xử lý request/response
package middlewares

import (
	"log"
	"net/http"
	"strconv"
	"strings"

	"gn-farm-go-server/global"
	"gn-farm-go-server/internal/utils/auth"

	"go.uber.org/zap"

	"github.com/gin-gonic/gin"
)

// JWTAuth - Middleware xác thực JWT token từ header Authorization
// Đây là phiên bản cải tiến, hỗ trợ các route public và error handling tốt hơn
func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Bỏ qua xác thực cho các route public để tối ưu performance
		if isPublicRoute(c.Request.URL.Path) {
			c.Next()
			return
		}

		// Trích xuất Bearer token từ Authorization header
		tokenString, valid := auth.ExtractBearerToken(c)
		if !valid {
			// Trả về lỗi 401 nếu không có token hoặc token không hợp lệ
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":  http.StatusUnauthorized,
				"error": "Missing or invalid token",
			})
			return
		}

		// Xác thực và decode JWT token để lấy thông tin người dùng
		claims, err := auth.VerifyTokenSubject(tokenString)
		if err != nil {
			// Ghi log lỗi và trả về unauthorized
			global.Logger.Error("Token verification failed", zap.Error(err))
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":  http.StatusUnauthorized,
				"error": "Invalid or expired token",
			})
			return
		}

		// Lưu thông tin user vào Gin context để các handler sau có thể sử dụng
		c.Set("userID", claims.Subject)
		c.Next()
	}
}

// JWTAuthMiddleware - Là alias của JWTAuth để tương thích ngược
// Sử dụng để không phải thay đổi code cũ khi migrate
func JWTAuthMiddleware() gin.HandlerFunc {
	return JWTAuth()
}

// isPublicRoute - Kiểm tra xem route có phải là public không
// Các route public không cần xác thực JWT token
func isPublicRoute(path string) bool {
	// Danh sách các route công khai không cần authentication
	publicRoutes := []string{
		"/api/v1/auth/login",        // Đăng nhập
		"/api/v1/auth/register",     // Đăng ký
		"/api/v1/auth/refresh-token", // Làm mới token
		"/api/v1/health",            // Kiểm tra sức khỏe hệ thống
		"/api/v1/ready",             // Kiểm tra sẵn sàng
		"/api/v1/live",              // Kiểm tra hoạt động
	}

	// Kiểm tra path hiện tại có trong danh sách public routes không
	for _, route := range publicRoutes {
		if path == route {
			return true
		}
	}
	return false
}

// AuthenMiddleware xác thực token từ header Authorization
func AuthenMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get the request url path
		uri := c.Request.URL.Path
		log.Println(" uri request: ", uri)

		// check headers authorization
		authHeader := c.GetHeader("Authorization")
		log.Println("Authorization header:", authHeader)

		jwtToken, valid := auth.ExtractBearerToken(c)
		log.Println("Extracted token:", jwtToken)
		log.Println("Token valid:", valid)

		if !valid {
			c.AbortWithStatusJSON(401, gin.H{"code": 40001, "err": "Unauthorized", "description": ""})
			return
		}

		// validate jwt token by subject
		claims, err := auth.VerifyTokenSubject(jwtToken)
		if err != nil {
			log.Println("Token verification error:", err)
			c.AbortWithStatusJSON(401, gin.H{"code": 40001, "err": "invalid token", "description": ""})
			return
		}
		// update claims to context
		log.Println("claims::: UUID::", claims.Subject) // 11clitoken....

		// Extract user_id from subject
		// Kiểm tra xem subject có chứa "clitoken" không
		if strings.Contains(claims.Subject, "clitoken") {
			// Định dạng cũ: "1clitoken..."
			parts := strings.Split(claims.Subject, "clitoken")
			if len(parts) != 2 {
				log.Println("Invalid token format")
				c.AbortWithStatusJSON(401, gin.H{"code": 40001, "err": "invalid token format", "description": ""})
				return
			}
			userId, err := strconv.ParseInt(parts[0], 10, 32)
			if err != nil {
				log.Println("Invalid user id in token:", err)
				c.AbortWithStatusJSON(401, gin.H{"code": 40001, "err": "invalid user id in token", "description": ""})
				return
			}
			// Set both subjectUUID and user_id in gin context
			c.Set("subjectUUID", claims.Subject)
			c.Set("user_id", int32(userId))
		} else {
			// Định dạng mới: UUID không chứa "clitoken"
			log.Println("Using new token format")
			c.Set("subjectUUID", claims.Subject)
			c.Set("user_id", int32(0)) // Đặt user_id mặc định là 0
		}

		// Không cần đặt lại ở đây vì đã đặt ở trên

		c.Next()
	}
}
