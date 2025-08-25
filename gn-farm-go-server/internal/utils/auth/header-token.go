// Package auth - Chứa các utility functions liên quan đến xác thực
package auth

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// ExtractBearerToken - Trích xuất JWT token từ Authorization header
// Xử lý format: "Authorization: Bearer {token}"
// Trả về token và trạng thái hợp lệ (true/false)
func ExtractBearerToken(c *gin.Context) (string, bool) {
	// Lấy giá trị của Authorization header
	// Format mong đợi: "Bearer {actual_token}"
	authHeader := c.GetHeader("Authorization")
	
	// Kiểm tra xem header có bắt đầu bằng "Bearer" không
	if strings.HasPrefix(authHeader, "Bearer") {
		// Loại bỏ "Bearer " (có khoảng trắng) để lấy token thực tế
		return strings.TrimPrefix(authHeader, "Bearer "), true
	}
	
	// Trả về rỗng và false nếu không tìm thấy Bearer token
	return "", false
}
