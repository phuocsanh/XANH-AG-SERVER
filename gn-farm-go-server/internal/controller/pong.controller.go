// Package controller chứa các controller xử lý HTTP requests
package controller

import (
	"fmt"      // In ra console để debug
	"net/http" // HTTP status codes

	"github.com/gin-gonic/gin" // Gin web framework
)

// PongController - Controller xử lý các endpoint test/ping
// Sử dụng để kiểm tra trạng thái hoạt động của server
type PongController struct{}

// NewPongController - Factory function tạo instance mới của PongController
// @return *PongController - Pointer đến instance đã tạo
func NewPongController() *PongController {
	return &PongController{} // Trả về empty struct
}

// Pong - Endpoint test đơn giản để kiểm tra server hoạt động
// Chức năng:
// - Nhận tham số name (mặc định "anonystick") và uid từ query string
// - Trả về JSON response với thông điệp pong và danh sách users mẫu
// - Sử dụng cho health check và test API connectivity
// @param c *gin.Context - Gin context chứa request/response data
func (p *PongController) Pong(c *gin.Context) {
	fmt.Println("---> My Handler") // Log để debug - hiển thị khi endpoint được gọi
	
	// Lấy tham số name từ query string, mặc định là "anonystick" nếu không có
	name := c.DefaultQuery("name", "anonystick")
	
	// Lấy tham số uid từ query string (có thể rỗng nếu không truyền)
	uid := c.Query("uid")
	
	// Trả về JSON response với HTTP 200 OK
	c.JSON(http.StatusOK, gin.H{ // gin.H là shorthand cho map[string]interface{}
		"message": "pong.hhhh..ping" + name, // Thông điệp pong kèm tên
		"uid":     uid,                      // User ID được truyền vào
		"users":   []string{"cr7", "m10", "anonysitck"}, // Danh sách users mẫu
	})
}
