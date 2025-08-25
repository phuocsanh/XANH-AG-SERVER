// Package service chứa các interface và implementation của business logic
// Định nghĩa các service interfaces cho user management và authentication
package service

import (
	"context" // Context cho các operations có thể timeout hoặc cancel

	"gn-farm-go-server/internal/database" // Database models và operations
	"gn-farm-go-server/internal/model"    // Common data models
	"gn-farm-go-server/internal/vo/user"  // User value objects (request/response DTOs)
)

type (
	// IUserAuth - Interface định nghĩa các method xác thực và quản lý người dùng
	// Bao gồm: đăng nhập, đăng ký, xác thực OTP, 2FA, token management
	IUserAuth interface {
		// Login - Xác thực thông tin đăng nhập và trả về token
		Login(ctx context.Context, in *user.LoginRequest) (codeResult int, out user.LoginResponse, err error)
		
		// Register - Đăng ký tài khoản mới và gửi OTP xác thực
		Register(ctx context.Context, in *user.RegisterRequest) (codeResult int, err error)
		
		// VerifyOTP - Xác thực mã OTP để kích hoạt tài khoản
		VerifyOTP(ctx context.Context, in *user.VerifyOTPRequest) (out user.VerifyOTPResponse, err error)
		
		// UpdatePasswordRegister - Cập nhật mật khẩu sau khi xác thực token
		UpdatePasswordRegister(ctx context.Context, token string, password string) (codeResult int, userId int64, err error)
		
		// RefreshToken - Làm mới access token sử dụng refresh token
		RefreshToken(ctx context.Context, refreshToken string) (codeResult int, out user.RefreshTokenResponse, err error)
		
		// Logout - Đăng xuất và vô hiệu hóa token
		Logout(ctx context.Context, token string) (codeResult int, out user.LogoutResponse, err error)

		// IsTwoFactorEnabled - Kiểm tra xem user có bật 2FA hay không
		IsTwoFactorEnabled(ctx context.Context, userId int32) (codeResult int, rs bool, err error)
		
		// SetupTwoFactorAuth - Thiết lập xác thực hai yếu tố cho user
		SetupTwoFactorAuth(ctx context.Context, in *user.SetupTwoFactorAuthServiceRequest) (codeResult int, err error)

		// VerifyTwoFactorAuth - Xác thực mã 2FA khi đăng nhập
		VerifyTwoFactorAuth(ctx context.Context, in *user.TwoFactorVerificationServiceRequest) (codeResult int, err error)

		// ListUsers - Lấy danh sách người dùng với phân trang và tìm kiếm
		ListUsers(ctx context.Context, input *model.PaginationRequest) (codeResult int, out *model.PaginatedResponse[database.UserProfile], err error)
	}

	// IUserInfo - Interface xử lý thông tin người dùng (profile, settings)
	IUserInfo interface {
		// GetInfoByUserId - Lấy thông tin chi tiết của user theo ID
		GetInfoByUserId(ctx context.Context) error
		
		// GetAllUser - Lấy danh sách tất cả người dùng
		GetAllUser(ctx context.Context) error
	}

	// IUserAdmin - Interface quản lý người dùng cho admin
	IUserAdmin interface {
		// RemoveUser - Xóa người dùng khỏi hệ thống
		RemoveUser(ctx context.Context) error
		
		// FindOneUser - Tìm kiếm một người dùng cụ thể
		FindOneUser(ctx context.Context) error
	}
)

// Các biến toàn cục lưu trữ singleton instances của các services
// Sử dụng dependency injection pattern để quản lý các service implementations
var (
	localUserAdmin IUserAdmin // Instance của UserAdmin service
	localUserInfo  IUserInfo  // Instance của UserInfo service
	localUserAuth  IUserAuth  // Instance của UserAuth service
)

// UserAdmin - Trả về singleton instance của UserAdmin service
// Sử dụng để truy cập các chức năng quản lý user dành cho admin
func UserAdmin() IUserAdmin {
	if localUserAdmin == nil {
		// Panic nếu chưa khởi tạo implementation - đảm bảo dependency injection
		panic("implement localUserAdmin not found for interface IUserAdmin")
	}
	return localUserAdmin
}

// InitUserAdmin - Khởi tạo UserAdmin service implementation
// Được gọi trong quá trình bootstrap ứng dụng để inject implementation
func InitUserAdmin(i IUserAdmin) {
	localUserAdmin = i
}

// UserInfo - Trả về singleton instance của UserInfo service
// Sử dụng để truy cập các chức năng quản lý thông tin user
func UserInfo() IUserInfo {
	if localUserInfo == nil {
		// Panic nếu chưa khởi tạo implementation - đảm bảo dependency injection
		panic("implement localUserInfo not found for interface IUserInfo")
	}
	return localUserInfo
}

// InitUserInfo - Khởi tạo UserInfo service implementation
// Được gọi trong quá trình bootstrap ứng dụng để inject implementation
func InitUserInfo(i IUserInfo) {
	localUserInfo = i
}

// UserAuth - Trả về singleton instance của UserAuth service
// Sử dụng để truy cập các chức năng authentication và authorization
func UserAuth() IUserAuth {
	if localUserAuth == nil {
		// Panic nếu chưa khởi tạo implementation - đảm bảo dependency injection
		panic("implement localUserAuth not found for interface IUserAuth")
	}
	return localUserAuth
}

// InitUserAuth - Khởi tạo UserAuth service implementation
// Được gọi trong quá trình bootstrap ứng dụng để inject implementation
func InitUserAuth(i IUserAuth) {
	localUserAuth = i
}
