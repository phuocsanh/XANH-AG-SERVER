// Package manage - Chứa các router quản lý người dùng cho admin
package manage

import "github.com/gin-gonic/gin"

// UserRouter - Cấu trúc quản lý các route liên quan đến người dùng dành cho admin
// Admin có thể thực hiện các thao tác quản lý người dùng như đăng ký, kích hoạt, v.v.
type UserRouter struct{}

// InitUserRouter - Khởi tạo các route quản lý người dùng cho admin
// Chia thành public routes (không cần auth) và private routes (cần admin auth)
func (pr *UserRouter) InitUserRouter(Router *gin.RouterGroup) {
	// Public router - Các route công khai cho việc đăng ký người dùng mới
	userRouterPublic := Router.Group("/manage/user")
	{
		// POST /manage/user/register - API đăng ký người dùng mới bởi admin
		// Admin có thể tạo tài khoản cho nhân viên hoặc người dùng khác
		userRouterPublic.POST("/register")
		// Có thể thêm OTP verification sau này:
		// userRouterPublic.POST("/otp") - Xác thực OTP cho đăng ký
	}
	// Private router - Các route riêng tư cần quyền admin
	userRouterPrivate := Router.Group("/manage/user")
	// Các middleware sẽ được kích hoạt sau:
	// userRouterPrivate.Use(limiter()) - Giới hạn tốc độ request
	// userRouterPrivate.Use(Authen()) - Xác thực JWT token
	// userRouterPrivate.Use(Permission()) - Kiểm tra quyền admin
	{
		// POST /manage/user/active_user_ - API kích hoạt/vô hiệu hóa tài khoản người dùng
		// Chỉ admin mới có quyền thay đổi trạng thái hoạt động của người dùng
		userRouterPrivate.POST("/active_user_")
	}
}
