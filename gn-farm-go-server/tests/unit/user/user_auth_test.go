//####################################################################
// USER AUTHENTICATION UNIT TESTS - UNIT TEST XÁC THỰC NGƯỜI DÙNG
// File này chứa các unit tests cho chức năng authentication
// 
// Các test cases bao gồm:
// - Đăng ký tài khoản mới (Register)
// - Đăng nhập vào hệ thống (Login) 
// - Validation các tham số đầu vào
// - Kiểm tra response codes và error handling
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

package user_test

import (
	"context"
	"testing"

	"gn-farm-go-server/internal/service/impl/user"
	"gn-farm-go-server/internal/testutil"
	uservo "gn-farm-go-server/internal/vo/user"
	"gn-farm-go-server/pkg/response"
)

// ===== TEST ĐĂNG KÝ TÀI KHOẢN =====
// TestUserAuth_Register kiểm tra chức năng đăng ký người dùng mới
// Bao gồm các test cases: hợp lệ, không hợp lệ, edge cases
func TestUserAuth_Register(t *testing.T) {
	// ===== THIẾT LậP MÔI TRƯỜNG TEST =====
	// Thiết lập test database và cleanup sau khi test
	queries := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t)

	// Tạo instance service để test
	service := user.NewUserAuthImpl(queries)

	// ===== ĐịNH NGHĨA TEST CASES =====
	// Mọi test case kiểm tra một scenario khác nhau
	tests := []struct {
		name     string                    // Tên mô tả test case
		input    *uservo.RegisterRequest    // Dữ liệu đầu vào
		wantCode int                       // Mã kết quả mong đợi
		wantErr  bool                      // Có mong đợi error hay không
	}{
		{
			name: "Valid registration",        // Test case thành công
			input: &uservo.RegisterRequest{
				VerifyKey:     "newuser@example.com",  // Email hợp lệ
				VerifyType:    1,                      // Loại xác thực: email
				VerifyPurpose: "TEST_USER",            // Mục đích test
			},
			wantCode: response.ErrCodeSuccess,     // Mong đợi thành công
			wantErr:  false,
		},
		{
			name: "Empty email",                  // Test case email trống
			input: &uservo.RegisterRequest{
				VerifyKey:     "",                    // Email rỗng
				VerifyType:    1,
				VerifyPurpose: "TEST_USER",
			},
			wantCode: response.ErrCodeParamInvalid, // Mong đợi lỗi tham số
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			code, err := service.Register(context.Background(), tt.input)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if code != tt.wantCode {
					t.Errorf("Expected code %d, got %d", tt.wantCode, code)
				}
			}
		})
	}
}

// TestUserAuth_Login tests user login functionality
func TestUserAuth_Login(t *testing.T) {
	// Setup test database
	queries := testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t)

	// Create service instance
	service := user.NewUserAuthImpl(queries)

	tests := []struct {
		name     string
		input    *uservo.LoginRequest
		wantCode int
		wantErr  bool
	}{
		{
			name: "Valid login credentials",
			input: &uservo.LoginRequest{
				UserAccount:  "test@example.com",
				UserPassword: "password123",
			},
			wantCode: response.ErrCodeSuccess,
			wantErr:  false,
		},
		{
			name: "Empty user account",
			input: &uservo.LoginRequest{
				UserAccount:  "",
				UserPassword: "password123",
			},
			wantCode: response.ErrCodeParamInvalid,
			wantErr:  true,
		},
		{
			name: "Empty password",
			input: &uservo.LoginRequest{
				UserAccount:  "test@example.com",
				UserPassword: "",
			},
			wantCode: response.ErrCodeParamInvalid,
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			code, result, err := service.Login(context.Background(), tt.input)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if code != tt.wantCode {
					t.Errorf("Expected code %d, got %d", tt.wantCode, code)
				}
				// Check if result has expected structure
				if result.User.UserAccount == "" {
					t.Errorf("Expected user account in result")
				}
				if result.Tokens.AccessToken == "" {
					t.Errorf("Expected access token in result")
				}
			}
		})
	}
}
