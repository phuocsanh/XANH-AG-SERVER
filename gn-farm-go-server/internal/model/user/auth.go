// Package user - Chứa các model liên quan đến người dùng và xác thực
package user

// ===== DOMAIN MODELS CHO AUTHENTICATION BUSINESS LOGIC =====
// Các model này đại diện cho các thực thể kinh doanh chính và use cases

// AuthenticationUseCase - Định nghĩa các use case cho authentication domain
// Chứa logic kinh doanh cốt lõi liên quan đến xác thực người dùng
// Các phương thức business logic sẽ được implement ở service layer
type AuthenticationUseCase struct {
	// Các phương thức business logic sẽ được thêm vào đây
	// Ví dụ: Login, Register, RefreshToken, Logout, etc.
}

// UserDomain - Đại diện cho user entity trong domain layer
// Chứa thông tin cốt lõi của người dùng, tách biệt khỏi database layer
type UserDomain struct {
	// ID - Mã định danh duy nhất của người dùng
	ID       int64
	// Account - Tên tài khoản (đăng nhập)
	Account  string
	// Email - Địa chỉ email của người dùng
	Email    string
	// Password - Mật khẩu đã được hash (không bao giờ lưu plain text)
	Password string
}

// TokenDomain - Đại diện cho token entity trong domain layer
// Chứa thông tin về JWT token và refresh token
type TokenDomain struct {
	// AccessToken - JWT token dùng để xác thực API requests
	AccessToken  string
	// RefreshToken - Token dùng để làm mới access token
	RefreshToken string
	// ExpiresIn - Thời gian hết hạn của access token (giây)
	ExpiresIn    int64
	// UserID - ID của người dùng mà token này thuộc về
	UserID       int64
}

// AuthenticationResult - Đại diện cho kết quả của quá trình xác thực
// Sử dụng để trả về kết quả đăng nhập/đăng ký thành công hoặc thất bại
type AuthenticationResult struct {
	// User - Thông tin người dùng sau khi xác thực thành công
	User         UserDomain
	// Token - Các token được cấp cho người dùng
	Token        TokenDomain
	// IsSuccessful - Xác thực có thành công hay không
	IsSuccessful bool
	// ErrorMessage - Thông điệp lỗi nếu xác thực thất bại
	ErrorMessage string
}
