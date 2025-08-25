// Package utils - Chứa các utility functions dùng chung trong hệ thống
package utils

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

// GetUserKey - Tạo key cho việc lưu trữ OTP của người dùng trong cache/Redis
// Format: "u:{hashKey}:otp" - giúp tổ chức và tra cứu OTP theo người dùng
func GetUserKey(hashKey string) string {
	return fmt.Sprintf("u:%s:otp", hashKey)
}

// GenerateCliTokenUUID - Tạo UUID token cho client authentication
// Kết hợp userId với UUID để tạo token duy nhất
// Format: "{userId}clitoken{UUID}" - Ví dụ: "10clitokenijkasdmfasikdjfpomgasdfglmasdlgmsdfpgk"
func GenerateCliTokenUUID(userId int) string {
	// Tạo UUID mới
	newUUID := uuid.New()
	// Chuyển UUID thành string và loại bỏ dấu gạch ngang
	uuidString := strings.ReplaceAll((newUUID).String(), "-", "")
	// Kết hợp userId + "clitoken" + UUID để tạo token duy nhất
	return strconv.Itoa(userId) + "clitoken" + uuidString
}
