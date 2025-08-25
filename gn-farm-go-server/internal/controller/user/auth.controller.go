// Package user chứa các controller xử lý user authentication và quản lý người dùng
// Bao gồm: đăng ký, đăng nhập, xác thực OTP, refresh token, logout
package user

import (
	"fmt"                                   // Format string operations
	"gn-farm-go-server/global"              // Global variables và logger
	"gn-farm-go-server/internal/model"      // Data models
	"gn-farm-go-server/internal/service"    // Business logic services
	"gn-farm-go-server/internal/utils/auth" // JWT authentication utilities
	"gn-farm-go-server/internal/vo/user"    // Value objects cho user requests/responses
	"gn-farm-go-server/pkg/response"        // Response formatting utilities
	"log"                                   // Standard logging
	"strings"                               // String manipulation utilities

	"github.com/gin-gonic/gin" // Gin web framework
	"go.uber.org/zap"          // Structured logging
)

// Auth - Global instance của user authentication controller (singleton pattern)
// Quản lý tất cả các chức năng xác thực người dùng
var Auth = new(cUserAuth)

// cUserAuth - Struct controller xử lý authentication của user
// Chứa các method: Register, Login, VerifyOTP, RefreshToken, Logout, UpdatePassword
type cUserAuth struct{}

// UpdatePasswordRegister - Cập nhật mật khẩu cho user sau khi xác thực token
// Chức năng:
// - Nhận token và mật khẩu mới từ request
// - Xác thực token hợp lệ
// - Cập nhật mật khẩu trong database
// - Trả về kết quả thành công hoặc lỗi
// @Summary      Cập nhật mật khẩu sau đăng ký
// @Description  Cập nhật mật khẩu cho user đã xác thực token
// @Tags         user management
// @Accept       json
// @Produce      json
// @Param        payload body user.UpdatePasswordRequest true "payload"
// @Success      200  {object}  response.ResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /user/update_pass_register [post]
func (c *cUserAuth) UpdatePasswordRegister(ctx *gin.Context) {
	// Parse và validate request body
	var req user.UpdatePasswordRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		// Trả về lỗi nếu dữ liệu request không hợp lệ
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Gọi service để xử lý business logic
	codeResult, result, err := service.UserAuth().UpdatePasswordRegister(ctx, req.UserToken, req.UserPassword)
	if err != nil {
		// Trả về lỗi nếu service thất bại
		response.ErrorResponse(ctx, codeResult, err.Error())
		return
	}
	// Trả về kết quả thành công
	response.SuccessResponse(ctx, response.ErrCodeSuccess, result)
}

// VerifyOTP - Xác thực OTP được gửi qua email sau khi đăng ký
// Chức năng:
// - Nhận mã OTP và thông tin xác thực từ user
// - Kiểm tra tính hợp lệ của OTP (thời gian, giá trị)
// - Kích hoạt tài khoản user nếu OTP đúng
// - Trả về thông tin xác thực thành công
// @Summary      Xác thực OTP cho đăng ký
// @Description  Xác thực mã OTP được gửi qua email
// @Tags         user management
// @Accept       json
// @Produce      json
// @Param        payload body user.VerifyOTPRequest true "payload"
// @Success      200  {object}  response.ResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /user/verify_account [post]
func (c *cUserAuth) VerifyOTP(ctx *gin.Context) {
	// Parse và validate request body
	var req user.VerifyOTPRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		// Trả về lỗi nếu dữ liệu request không hợp lệ
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Gọi service để xử lý logic xác thực OTP
	result, err := service.UserAuth().VerifyOTP(ctx, &req)
	if err != nil {
		// Trả về lỗi OTP không hợp lệ hoặc hết hạn
		response.ErrorResponse(ctx, response.ErrInvalidOTP, err.Error())
		return
	}
	// Trả về kết quả xác thực thành công
	response.SuccessResponse(ctx, response.ErrCodeSuccess, result)
}

// Login - Xử lý quá trình đăng nhập của user
// Chức năng:
// - Nhận thông tin đăng nhập (email/username và password)
// - Xác thực thông tin đăng nhập
// - Tạo JWT access token và refresh token
// - Trả về thông tin user và tokens
// @Summary      Đăng nhập người dùng
// @Description  Xác thực thông tin đăng nhập và trả về tokens
// @Tags         user management
// @Accept       json
// @Produce      json
// @Param        payload body user.LoginRequest true "payload"
// @Success      200  {object}  response.ResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /user/login [post]
func (c *cUserAuth) Login(ctx *gin.Context) {
	// Parse và validate request body
	var req user.LoginRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		// Trả về lỗi nếu dữ liệu request không hợp lệ
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Gọi service để xử lý logic đăng nhập
	codeRs, dataRs, err := service.UserAuth().Login(ctx, &req)
	if err != nil {
		// Trả về lỗi nếu đăng nhập thất bại
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}
	// Trả về kết quả đăng nhập thành công (user info + tokens)
	response.SuccessResponse(ctx, codeRs, dataRs)
}

// Register - Xử lý quá trình đăng ký tài khoản mới
// Chức năng:
// - Nhận thông tin đăng ký (email, username, password)
// - Kiểm tra email/username chưa tồn tại
// - Tạo tài khoản tạm thời (chưa active)
// - Gửi mã OTP qua email để xác thực
// - Trả về thông báo thành công
// @Summary      Đăng ký người dùng
// @Description  Đăng ký tài khoản mới và gửi OTP qua email
// @Tags         user management
// @Accept       json
// @Produce      json
// @Param        payload body user.RegisterRequest true "payload"
// @Success      200  {object}  response.ResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /user/register [post]
func (c *cUserAuth) Register(ctx *gin.Context) {
	// Parse và validate request body
	var req user.RegisterRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		// Trả về lỗi nếu dữ liệu request không hợp lệ
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Gọi service để xử lý logic đăng ký và gửi OTP
	codeStatus, err := service.UserAuth().Register(ctx, &req)
	if err != nil {
		// Log lỗi và trả về response lỗi
		global.Logger.Error("Lỗi khi đăng ký user và gửi OTP", zap.Error(err))
		response.ErrorResponse(ctx, codeStatus, err.Error())
		return
	}
	// Nếu mã trả về không phải success, trả lỗi tương ứng
	if codeStatus != response.ErrCodeSuccess {
		response.ErrorResponse(ctx, codeStatus, "")
		return
	}
	// Trả về thông báo đăng ký thành công
	response.SuccessResponse(ctx, response.ErrCodeSuccess, nil)
}

// RefreshToken - Làm mới access token sử dụng refresh token
// Chức năng:
// - Nhận refresh token từ request
// - Xác thực refresh token hợp lệ và chưa hết hạn
// - Tạo access token mới
// - Trả về access token mới và (tùy chọn) refresh token mới
// @Summary      Làm mới Token
// @Description  Làm mới access token sử dụng refresh token
// @Tags         user management
// @Accept       json
// @Produce      json
// @Param        payload body user.RefreshTokenRequest true "payload"
// @Success      200  {object}  response.ResponseData
// @Failure      500  {object}  response.ErrorResponseData
// @Router       /user/refresh-token [post]
func (c *cUserAuth) RefreshToken(ctx *gin.Context) {
	// Parse và validate request body
	var req user.RefreshTokenRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		// Trả về lỗi nếu dữ liệu request không hợp lệ
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Gọi service để xử lý logic refresh token
	codeRs, dataRs, err := service.UserAuth().RefreshToken(ctx, req.RefreshToken)
	if err != nil {
		// Trả về lỗi nếu refresh token không hợp lệ
		response.ErrorResponse(ctx, codeRs, err.Error())
		return
	}
	// Trả về token mới thành công
	response.SuccessResponse(ctx, codeRs, dataRs)
}

// Logout - Xử lý quá trình đăng xuất và vô hiệu hóa token
// Chức năng:
// - Lấy token từ Authorization header
// - Kiểm tra định dạng "Bearer token"
// - Xác thực token hợp lệ
// - Đưa token vào blacklist hoặc xóa khỏi cache
// - Trả về kết quả đăng xuất thành công
// @Summary      Đăng xuất
// @Description  Đăng xuất người dùng và vô hiệu hóa token
// @Tags         user management
// @Accept       json
// @Produce      json
// @Param        Authorization header string true "Bearer token"
// @Success      200  {object}  response.ResponseData
// @Failure      401  {object}  response.ErrorResponseData
// @Router       /user/logout [post]
func (c *cUserAuth) Logout(ctx *gin.Context) {
	// Lấy token từ header Authorization
	authHeader := ctx.GetHeader("Authorization")
	if authHeader == "" {
		// Trả về lỗi nếu không có Authorization header
		response.ErrorResponse(ctx, response.ErrCodeAuthFailed, "Authorization header is required")
		return
	}

	// Kiểm tra định dạng "Bearer token"
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		// Trả về lỗi nếu định dạng Authorization header không đúng
		response.ErrorResponse(ctx, response.ErrCodeAuthFailed, "Authorization header format must be Bearer {token}")
		return
	}

	token := parts[1] // Trích xuất token từ header
	log.Println("Logout token:", token)

	// Xác thực token trước khi gọi service
	claims, err := auth.VerifyTokenSubject(token)
	if err != nil {
		// Log và trả về lỗi nếu token không hợp lệ
		log.Println("Lỗi xác thực token trong controller:", err)
		response.ErrorResponse(ctx, response.ErrCodeAuthFailed, fmt.Sprintf("Token không hợp lệ: %v", err))
		return
	}
	log.Println("Token subject:", claims.Subject)

	// Gọi service để xử lý logic logout
	codeRs, dataRs, err := service.UserAuth().Logout(ctx, token)
	if err != nil {
		// Trả về lỗi nếu logout thất bại
		response.ErrorResponse(ctx, codeRs, err.Error())
		return
	}
	// Trả về kết quả logout thành công
	response.SuccessResponse(ctx, codeRs, dataRs)
}

// ListUsers - Lấy danh sách người dùng với phân trang và tìm kiếm
// Chức năng:
// - Hỗ trợ phân trang (page, pageSize)
// - Hỗ trợ tìm kiếm theo tên đăng nhập hoặc nickname
// - Kiểm tra quyền truy cập (cần token hợp lệ)
// - Trả về danh sách user kèm thông tin phân trang
// @Summary      Danh sách người dùng
// @Description  Lấy danh sách người dùng có phân trang và tìm kiếm tùy chọn
// @Tags         user management
// @Accept       json
// @Produce      json
// @Param        page query int false "Số trang (mặc định: 1)" example(1)
// @Param        pageSize query int false "Số item mỗi trang (mặc định: 10, tối đa: 100)" example(10)
// @Param        search query string false "Tìm kiếm theo tên đăng nhập hoặc nickname" example("john")
// @Param        Authorization header string true "Bearer token"
// @Success      200  {object}  response.ResponseData
// @Failure      401  {object}  response.ErrorResponseData
// @Router       /user/list [get]
func (c *cUserAuth) ListUsers(ctx *gin.Context) {
	// Parse các tham số query string (page, pageSize, search)
	var req model.PaginationRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		// Trả về lỗi nếu tham số query không hợp lệ
		response.ErrorResponse(ctx, response.ErrCodeParamInvalid, err.Error())
		return
	}

	// Gọi service để xử lý logic lấy danh sách (validation được thực hiện ở service layer)
	codeRs, dataRs, err := service.UserAuth().ListUsers(ctx, &req)
	if err != nil {
		// Trả về lỗi nếu không lấy được danh sách
		response.ErrorResponse(ctx, codeRs, err.Error())
		return
	}
	// Trả về danh sách user thành công
	response.SuccessResponse(ctx, codeRs, dataRs)
}

// AUTO-RELOAD LIVE TEST
