//####################################################################
// HTTP STATUS CODES VÀ ERROR MESSAGES - GN FARM API
// File này định nghĩa tất cả mã lỗi và thông báo cho API
// Bao gồm cả HTTP status codes chuẩn và custom error codes
//
// Phân loại mã lỗi:
// - 2xx: Thành công (200-299)
// - 3xx: Token/Authentication (30000-39999)
// - 4xx: User authentication (40000-49999)
// - 5xx: User registration (50000-59999)
// - 6xx: Login/OTP (60000-69999)
// - 8xx: Two Factor Auth (80000-89999)
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

package response

// ===== HTTP STATUS CODES CHUẨN =====
// Các mã HTTP chuẩn có thể dùng trực tiếp hoặc mapping
const (
	// Standard HTTP Codes (can be used directly or mapped)
	ErrCodeSuccess             = 200 // Thành công - Generally use http.StatusOK
	ErrCodeParamInvalid        = 400 // Tham số không hợp lệ - Generally use http.StatusBadRequest
	ErrCodeUnauthorized        = 401 // Chưa xác thực - Generally use http.StatusUnauthorized
	ErrCodeForbidden           = 403 // Không đủ quyền - Generally use http.StatusForbidden
	ErrCodeNotFound            = 404 // Không tìm thấy - Generally use http.StatusNotFound
	ErrCodeInternalServerError = 500 // Lỗi server nội bộ - Generally use http.StatusInternalServerError

	// ===== CUSTOM APPLICATION CODES - MÃ ỨNG DỤNG TÙY CHỈNH =====
	ErrCodeSuccessCustom      = 20001 // Thành công tùy chỉnh
	ErrCodeParamInvalidCustom = 20003 // Tham số không hợp lệ cụ thể (VD: Email sai định dạng)

	// ===== TOKEN VÀ AUTHENTICATION CODES (30xxx) =====
	ErrInvalidToken = 30001 // Token không hợp lệ hoặc hết hạn
	ErrInvalidOTP   = 30002 // Mã OTP không đúng hoặc hết hạn
	ErrSendEmailOtp = 30003 // Gửi email OTP thất bại
	
	// ===== USER AUTHENTICATION CODES (40xxx) =====
	ErrCodeAuthFailed = 40005 // Xác thực thất bại (sai username/password)
	
	// ===== USER REGISTRATION CODES (50xxx) =====
	ErrCodeUserHasExists = 50001 // Người dùng đã tồn tại

	// ===== LOGIN VÀ OTP CODES (60xxx) =====
	ErrCodeOtpNotExists     = 60009 // OTP tồn tại nhưng chưa đăng ký
	ErrCodeUserOtpNotExists = 60008 // Người dùng không có OTP

	// ===== TWO FACTOR AUTHENTICATION CODES (80xxx) =====
	ErrCodeTwoFactorAuthSetupFailed  = 80001 // Thiết lập 2FA thất bại
	ErrCodeTwoFactorAuthVerifyFailed = 80002 // Xác thực 2FA thất bại
)

// ===== BẢNG ÁNH XẠ ERROR MESSAGES =====
// Mapping từ error codes sang thông báo lỗi tiếng Anh chuẩn
// Sử dụng trong các hàm response để trả về message nhất quán
var msg = map[int]string{
	// ===== HTTP STATUS MESSAGES - THÔNG BÁO HTTP CHUẨN =====
	ErrCodeSuccess:             "Success",
	ErrCodeParamInvalid:        "Invalid parameters",
	ErrCodeUnauthorized:        "Unauthorized",
	ErrCodeForbidden:           "Forbidden",
	ErrCodeNotFound:            "Not found",
	ErrCodeInternalServerError: "Internal server error",

	// ===== CUSTOM APPLICATION MESSAGES =====
	ErrCodeSuccessCustom:      "success",
	ErrCodeParamInvalidCustom: "Email is invalid", // Ví dụ thông báo cụ thể
	
	// ===== TOKEN VÀ AUTHENTICATION MESSAGES =====
	ErrInvalidToken:           "token is invalid",
	ErrInvalidOTP:             "Otp error",
	ErrSendEmailOtp:           "Failed to send email OTP",

	// ===== USER REGISTRATION MESSAGES =====
	ErrCodeUserHasExists: "user has already registered",

	// ===== LOGIN VÀ OTP MESSAGES =====
	ErrCodeOtpNotExists:     "OTP exists but not registered",
	ErrCodeUserOtpNotExists: "User OTP not exists",
	ErrCodeAuthFailed:       "Authentication failed",

	// ===== TWO FACTOR AUTHENTICATION MESSAGES =====
	ErrCodeTwoFactorAuthSetupFailed:  "Two Factor Authentication setup failed",
	ErrCodeTwoFactorAuthVerifyFailed: "Two Factor Authentication verify failed",
}
