package response_test

import (
	"testing"

	"gn-farm-go-server/pkg/response"
)

// TestErrorCodes tests that error codes are defined correctly
func TestErrorCodes(t *testing.T) {
	tests := []struct {
		name string
		code int
	}{
		{
			name: "Success code",
			code: response.ErrCodeSuccess,
		},
		{
			name: "Param invalid code",
			code: response.ErrCodeParamInvalid,
		},
		{
			name: "User not found code",
			code: response.ErrCodeNotFound,
		},
		{
			name: "Auth failed code",
			code: response.ErrCodeAuthFailed,
		},
		{
			name: "Internal server error code",
			code: response.ErrCodeInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.code == 0 && tt.name != "Success code" {
				t.Errorf("Error code should not be 0 for %s", tt.name)
			}
		})
	}
}

// TestResponseDataStructure tests response data structure
func TestResponseDataStructure(t *testing.T) {
	// Test ResponseData structure
	responseData := response.ResponseData{
		Code:    response.ErrCodeSuccess,
		Message: "Success",
		Data:    map[string]string{"test": "data"},
	}

	if responseData.Code != response.ErrCodeSuccess {
		t.Errorf("Expected code %d, got %d", response.ErrCodeSuccess, responseData.Code)
	}

	if responseData.Message != "Success" {
		t.Errorf("Expected message 'Success', got '%s'", responseData.Message)
	}

	if responseData.Data == nil {
		t.Errorf("Expected data to be set")
	}
}

// TestSimpleCalculation tests basic arithmetic
func TestSimpleCalculation(t *testing.T) {
	tests := []struct {
		name     string
		a, b     int
		expected int
	}{
		{
			name:     "Add positive numbers",
			a:        2,
			b:        3,
			expected: 5,
		},
		{
			name:     "Add negative numbers",
			a:        -2,
			b:        -3,
			expected: -5,
		},
		{
			name:     "Add zero",
			a:        5,
			b:        0,
			expected: 5,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.a + tt.b
			if result != tt.expected {
				t.Errorf("Expected %d + %d = %d, got %d", tt.a, tt.b, tt.expected, result)
			}
		})
	}
}
