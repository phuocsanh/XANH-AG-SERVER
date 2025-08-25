// Package user - Controller xử lý Two-Factor Authentication (2FA)
// Cung cấp các endpoint để thiết lập và xác thực 2FA cho bảo mật tăng cường
package user

import (
	"strconv" // String conversion utilities
	"strings" // String manipulation utilities

	"gn-farm-go-server/internal/service" // Business logic services
	"gn-farm-go-server/internal/vo/user" // User value objects
	"gn-farm-go-server/pkg/response"     // Response formatting utilities

	"github.com/gin-gonic/gin" // Gin web framework
)

// TwoFA - Global instance của 2FA controller (singleton pattern)
// Quản lý các chức năng xác thực 2 yếu tố
var TwoFA = new(sUser2FA)

// sUser2FA - Struct controller xử lý Two-Factor Authentication
// Chứa các method: SetupTwoFactorAuth, VerifyTwoFactorAuth
type sUser2FA struct{}

// SetupTwoFactorAuth - Thiết lập xác thực hai yếu tố (2FA) cho user
// Chức năng:
// - Lấy thông tin user từ JWT token
// - Xử lý cấu hình 2FA (email hoặc authenticator app)
// - Tạo mã bí mật 2FA và gửi email hướng dẫn
// - Kích hoạt 2FA cho tài khoản
// @Summary      Thiết lập xác thực hai yếu tố
// @Description  Thiết lập 2FA để tăng cường bảo mật tài khoản
// @Tags         user 2fa
// @Accept       json
// @Produce      json
// @param Authorization header string true "Authorization token" example:"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
// @Param        payload body user.SetupTwoFactorAuthRequest true "payload"
// @Success      200  {object}  response.ResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /user/two-factor/setup [post]
func (c *sUser2FA) SetupTwoFactorAuth(ctx *gin.Context) {
	// Lấy subjectUUID từ JWT token (do middleware đã parse)
	subjectUUID, exists := ctx.Get("subjectUUID")
	if !exists {
		// Trả về lỗi nếu user chưa được xác thực
		response.ErrorResponse(ctx, response.ErrCodeAuthFailed, "user not authenticated")
		return
	}

	// Parse và validate request body
	var req user.SetupTwoFactorAuthRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		// Trả về lỗi nếu dữ liệu request không hợp lệ
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Chuẩn bị dữ liệu cho service (thêm UserId từ JWT)
	params := user.SetupTwoFactorAuthServiceRequest{
		TwoFactorAuthType: req.TwoFactorAuthType, // Loại 2FA (email hoặc app)
		TwoFactorEmail:    req.TwoFactorEmail,    // Email nhận mã 2FA
	}

	// Trích xuất user_id từ subjectUUID (định dạng: "1clitoken...")
	subjectStr := subjectUUID.(string)
	parts := strings.Split(subjectStr, "clitoken")
	if len(parts) != 2 {
		// Trả về lỗi nếu định dạng token không hợp lệ
		response.ErrorResponse(ctx, response.ErrCodeAuthFailed, "invalid token format")
		return
	}
	userId, err := strconv.ParseUint(parts[0], 10, 32) // Convert string thành uint
	if err != nil {
		// Trả về lỗi nếu không parse được user ID
		response.ErrorResponse(ctx, response.ErrCodeAuthFailed, "invalid user id in token")
		return
	}

	// Gán user_id vào params
	params.UserId = uint32(userId)

	// Gọi service để xử lý logic thiết lập 2FA
	code, err := service.UserAuth().SetupTwoFactorAuth(ctx, &params)
	if err != nil {
		// Trả về lỗi nếu thiết lập thất bại
		response.ErrorResponse(ctx, code, err.Error())
		return
	}

	// Trả về kết quả thiết lập thành công
	response.SuccessResponse(ctx, code, nil)
}

// VerifyTwoFactorAuth - Xác thực mã 2FA khi user đăng nhập
// Chức năng:
// - Lấy thông tin user từ JWT token
// - Nhận mã xác thực 2FA từ user
// - Kiểm tra tính hợp lệ của mã 2FA
// - Xác nhận hoàn tất quá trình đăng nhập bảo mật
// @Summary      Xác thực hai yếu tố
// @Description  Xác thực mã 2FA để hoàn tất đăng nhập
// @Tags         user 2fa
// @Accept       json
// @Produce      json
// @param Authorization header string true "Authorization token" example:"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
// @Param        payload body user.TwoFactorVerificationRequest true "payload"
// @Success      200  {object}  response.ResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /user/two-factor/verify [post]
func (c *sUser2FA) VerifyTwoFactorAuth(ctx *gin.Context) {
	// Lấy subjectUUID từ JWT token (do middleware đã parse)
	subjectUUID, exists := ctx.Get("subjectUUID")
	if !exists {
		// Trả về lỗi nếu user chưa được xác thực
		response.ErrorResponse(ctx, response.ErrCodeAuthFailed, "user not authenticated")
		return
	}

	// Parse và validate request body
	var req user.TwoFactorVerificationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		// Trả về lỗi nếu dữ liệu request không hợp lệ
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Chuẩn bị dữ liệu cho service
	params := user.TwoFactorVerificationServiceRequest{
		TwoFactorCode: req.VerifyCode, // Mã xác thực 2FA
	}

	// Trích xuất user_id từ subjectUUID (định dạng: "1clitoken...")
	subjectStr := subjectUUID.(string)
	parts := strings.Split(subjectStr, "clitoken")
	if len(parts) != 2 {
		// Trả về lỗi nếu định dạng token không hợp lệ
		response.ErrorResponse(ctx, response.ErrCodeAuthFailed, "invalid token format")
		return
	}
	userId, err := strconv.ParseUint(parts[0], 10, 32) // Convert string thành uint
	if err != nil {
		// Trả về lỗi nếu không parse được user ID
		response.ErrorResponse(ctx, response.ErrCodeAuthFailed, "invalid user id in token")
		return
	}

	// Gán user_id vào params
	params.UserId = uint32(userId)

	// Gọi service để xử lý logic xác thực 2FA
	code, err := service.UserAuth().VerifyTwoFactorAuth(ctx, &params)
	if err != nil {
		// Trả về lỗi nếu xác thực thất bại
		response.ErrorResponse(ctx, code, err.Error())
		return
	}

	// Trả về kết quả xác thực thành công
	response.SuccessResponse(ctx, code, nil)
}
