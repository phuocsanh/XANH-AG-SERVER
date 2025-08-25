package user

// LoginRequest định nghĩa cấu trúc cho request đăng nhập
type LoginRequest struct {
	UserAccount  string `json:"userAccount" example:"user@example.com"`
	UserPassword string `json:"userPassword" example:"securePassword123"`
}

// RegisterRequest định nghĩa cấu trúc cho request đăng ký
type RegisterRequest struct {
	VerifyKey     string `json:"verifyKey" example:"user@example.com"`
	VerifyType    int    `json:"verifyType" example:"1"`
	VerifyPurpose string `json:"verifyPurpose" example:"TEST_USER"`
}

// VerifyOTPRequest định nghĩa cấu trúc cho request xác thực OTP
type VerifyOTPRequest struct {
	VerifyKey  string `json:"verifyKey" example:"user@example.com"`
	VerifyCode string `json:"verifyCode" example:"123456"`
}

// UpdatePasswordRequest định nghĩa cấu trúc cho request cập nhật mật khẩu
type UpdatePasswordRequest struct {
	UserToken    string `json:"userToken" example:"abc123token"`
	UserPassword string `json:"userPassword" example:"newSecurePassword123"`
}

// RefreshTokenRequest định nghĩa cấu trúc cho request làm mới token
type RefreshTokenRequest struct {
	RefreshToken string `json:"refreshToken" example:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
}

// SetupTwoFactorAuthRequest định nghĩa cấu trúc cho request thiết lập xác thực 2 yếu tố
type SetupTwoFactorAuthRequest struct {
	TwoFactorAuthType string `json:"twoFactorAuthType" example:"EMAIL"`
	TwoFactorEmail    string `json:"twoFactorEmail" example:"user@example.com"`
}

// TwoFactorVerificationRequest định nghĩa cấu trúc cho request xác thực 2 yếu tố
type TwoFactorVerificationRequest struct {
	VerifyKey  string `json:"verifyKey" example:"user@example.com"`
	VerifyCode string `json:"verifyCode" example:"123456"`
}

// =============================================================================
// SERVICE LAYER TYPES (Internal use only - include additional context like UserId from JWT)
// =============================================================================

// SetupTwoFactorAuthServiceRequest for service layer (includes UserId from JWT)
type SetupTwoFactorAuthServiceRequest struct {
	UserId            uint32 `json:"userId"`
	TwoFactorAuthType string `json:"twoFactorAuthType"`
	TwoFactorEmail    string `json:"twoFactorEmail"`
}

// TwoFactorVerificationServiceRequest for service layer (includes UserId from JWT)
type TwoFactorVerificationServiceRequest struct {
	UserId        uint32 `json:"userId"`
	TwoFactorCode string `json:"twoFactorCode"`
}
