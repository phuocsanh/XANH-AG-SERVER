package user

// UserInfo định nghĩa thông tin user cơ bản
type UserInfo struct {
	UserID      int64  `json:"userId"`
	UserAccount string `json:"userAccount"`
	UserEmail   string `json:"userEmail"`
}

// TokenPair định nghĩa cặp access và refresh token
type TokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}



// LoginResponse định nghĩa cấu trúc cho response đăng nhập
type LoginResponse struct {
	User      UserInfo  `json:"user"`
	Tokens    TokenPair `json:"tokens"`
	ExpiresIn int       `json:"expiresIn"`
	Message   string    `json:"message,omitempty"`
}



// VerifyOTPResponse định nghĩa cấu trúc cho response xác thực OTP
type VerifyOTPResponse struct {
	VerifyToken string    `json:"verifyToken,omitempty"`
	User        UserInfo  `json:"user,omitempty"`
	Tokens      TokenPair `json:"tokens,omitempty"`
	ExpiresIn   int       `json:"expiresIn,omitempty"`
	Message     string    `json:"message,omitempty"`
}

// RefreshTokenResponse định nghĩa cấu trúc cho response refresh token
type RefreshTokenResponse struct {
	User      UserInfo  `json:"user"`
	Tokens    TokenPair `json:"tokens"`
	ExpiresIn int       `json:"expiresIn"`
	Message   string    `json:"message,omitempty"`
}

// LogoutResponse định nghĩa cấu trúc cho response đăng xuất
type LogoutResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}


