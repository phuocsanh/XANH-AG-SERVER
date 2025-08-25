package api_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gn-farm-go-server/internal/initialize"
	"gn-farm-go-server/internal/testutil"
	uservo "gn-farm-go-server/internal/vo/user"

	"github.com/gin-gonic/gin"
)

// TestUserRegistration tests user registration API endpoint
func TestUserRegistration(t *testing.T) {
	// Setup test database
	_ = testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t)

	// Initialize router
	gin.SetMode(gin.TestMode)
	router := initialize.Run()

	tests := []struct {
		name           string
		payload        uservo.RegisterRequest
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "Valid registration",
			payload: uservo.RegisterRequest{
				VerifyKey:     "test@example.com",
				VerifyType:    1,
				VerifyPurpose: "TEST_USER",
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "Invalid email format",
			payload: uservo.RegisterRequest{
				VerifyKey:     "invalid-email",
				VerifyType:    1,
				VerifyPurpose: "TEST_USER",
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "Empty verify key",
			payload: uservo.RegisterRequest{
				VerifyKey:     "",
				VerifyType:    1,
				VerifyPurpose: "TEST_USER",
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Prepare request body
			jsonBody, err := json.Marshal(tt.payload)
			if err != nil {
				t.Fatalf("Failed to marshal payload: %v", err)
			}

			// Create request
			req, err := http.NewRequest("POST", "/v1/user/register", bytes.NewBuffer(jsonBody))
			if err != nil {
				t.Fatalf("Failed to create request: %v", err)
			}
			req.Header.Set("Content-Type", "application/json")

			// Create response recorder
			w := httptest.NewRecorder()

			// Perform request
			router.ServeHTTP(w, req)

			// Assert status code
			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			// Parse response
			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			if err != nil {
				t.Fatalf("Failed to unmarshal response: %v", err)
			}

			if tt.expectedError {
				if response["code"] == float64(200) {
					t.Errorf("Expected error but got success")
				}
			} else {
				if response["code"] != float64(200) {
					t.Errorf("Expected success but got error: %v", response)
				}
				if response["data"] == nil {
					t.Errorf("Expected data in response")
				}
			}
		})
	}
}

// TestUserLogin tests user login API endpoint
func TestUserLogin(t *testing.T) {
	// Setup test database
	_ = testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t)

	// Initialize router
	gin.SetMode(gin.TestMode)
	router := initialize.Run()

	tests := []struct {
		name           string
		payload        uservo.LoginRequest
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "Valid login credentials",
			payload: uservo.LoginRequest{
				UserAccount:  "test@example.com",
				UserPassword: "password123",
			},
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name: "Empty user account",
			payload: uservo.LoginRequest{
				UserAccount:  "",
				UserPassword: "password123",
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "Empty password",
			payload: uservo.LoginRequest{
				UserAccount:  "test@example.com",
				UserPassword: "",
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Prepare request body
			jsonBody, err := json.Marshal(tt.payload)
			if err != nil {
				t.Fatalf("Failed to marshal payload: %v", err)
			}

			// Create request
			req, err := http.NewRequest("POST", "/v1/user/login", bytes.NewBuffer(jsonBody))
			if err != nil {
				t.Fatalf("Failed to create request: %v", err)
			}
			req.Header.Set("Content-Type", "application/json")

			// Create response recorder
			w := httptest.NewRecorder()

			// Perform request
			router.ServeHTTP(w, req)

			// Assert status code
			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			// Parse response
			var response map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &response)
			if err != nil {
				t.Fatalf("Failed to unmarshal response: %v", err)
			}

			if tt.expectedError {
				if response["code"] == float64(200) {
					t.Errorf("Expected error but got success")
				}
			} else {
				if response["code"] != float64(200) {
					t.Errorf("Expected success but got error: %v", response)
				}
				if response["data"] == nil {
					t.Errorf("Expected data in response")
				}
			}
		})
	}
}
