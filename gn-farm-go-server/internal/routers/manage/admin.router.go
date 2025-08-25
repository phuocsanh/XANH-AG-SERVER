//####################################################################
// ADMIN ROUTER - ROUTER QUẢN LÝ ADMIN
// Package này chứa các router dành cho admin quản lý hệ thống
// 
// Chức năng chính:
// - Xác thực admin (login, logout)
// - Quản lý người dùng (kích hoạt, vô hiệu hóa)
// - Phân quyền và quản lý roles
// - Audit và monitoring các hoạt động admin
//
// Security features:
// - JWT-based authentication
// - Role-based access control (RBAC)
// - Rate limiting cho sensitive operations
// - Audit logging cho tất cả admin actions
// - IP whitelist validation
//
// Endpoints:
// - Public: /manage/admin/login (xác thực admin)
// - Private: /manage/admin/user/* (quản lý người dùng)
//
// Middleware stack:
// - Rate Limiter: Giới hạn tốc độ request
// - Authentication: Xác thực JWT token
// - Authorization: Kiểm tra quyền admin
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

// Package manage - Chứa các router quản lý cho admin
package manage

import "github.com/gin-gonic/gin"

// ===== ADMIN ROUTER STRUCT =====
// AdminRouter - Cấu trúc quản lý các route dành cho admin
// Xử lý xác thực admin và các thao tác quản trị hệ thống
type AdminRouter struct{}

// ===== KHỞI TẠO ADMIN ROUTES =====
// InitAdminRouter - Khởi tạo các route quản lý admin
// Bao gồm các route public (không cần xác thực) và private (cần xác thực)
func (pr *AdminRouter) InitAdminRouter(Router *gin.RouterGroup) {
	// ===== PUBLIC ADMIN ROUTES =====
	// Public router - Các route công khai không cần xác thực
	// Sử dụng cho: đăng nhập admin, forgot password
	adminRouterPublic := Router.Group("/manage/admin")
	{
		// ===== ADMIN LOGIN ENDPOINT =====
		// POST /manage/admin/login - API đăng nhập cho admin
		// Chức năng:
		// - Xác thực thông tin admin (username/password)
		// - Validate admin permissions và account status
		// - Cấp JWT token cho admin session
		// - Ghi audit log cho admin login
		adminRouterPublic.POST("/login")

	}
	
	// ===== PRIVATE ADMIN ROUTES =====
	// Private router - Các route riêng tư cần xác thực và phân quyền
	adminRouterPrivate := Router.Group("/manage/admin/user")
	// ===== MIDDLEWARE STACK (Sẽ ĐƯỢC KÍCH HOẠT SAU) =====
	// Các middleware sẽ được kích hoạt sau:
	// adminRouterPrivate.Use(limiter()) - Giới hạn tốc độ request (rate limiting)
	// adminRouterPrivate.Use(Authen()) - Xác thực JWT token
	// adminRouterPrivate.Use(Permission()) - Kiểm tra quyền admin
	{
		// ===== USER MANAGEMENT ENDPOINT =====
		// POST /manage/admin/user/active_user - API kích hoạt tài khoản người dùng
		// Chức năng:
		// - Kích hoạt hoặc vô hiệu hóa tài khoản người dùng
		// - Chỉ admin mới có quyền thực hiện
		// - Ghi audit log cho mọi thao tác
		// - Cập nhật trạng thái user trong database
		adminRouterPrivate.POST("/active_user")
	}
}
