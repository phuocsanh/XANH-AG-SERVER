package e2e_test

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

// TestCompleteUserFlow tests the complete user registration and login flow
func TestCompleteUserFlow(t *testing.T) {
	// Setup test database
	_ = testutil.SetupTestDB(t)
	defer testutil.CleanupTestDB(t)

	// Initialize router
	gin.SetMode(gin.TestMode)
	router := initialize.Run()

	// Step 1: Register a new user
	registerPayload := uservo.RegisterRequest{
		VerifyKey:     "e2etest@example.com",
		VerifyType:    1,
		VerifyPurpose: "TEST_USER",
	}

	// Register user
	jsonBody, err := json.Marshal(registerPayload)
	if err != nil {
		t.Fatalf("Failed to marshal register payload: %v", err)
	}

	req, err := http.NewRequest("POST", "/v1/user/register", bytes.NewBuffer(jsonBody))
	if err != nil {
		t.Fatalf("Failed to create register request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert registration success
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var registerResponse map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &registerResponse)
	if err != nil {
		t.Fatalf("Failed to unmarshal register response: %v", err)
	}

	if registerResponse["code"] != float64(200) {
		t.Errorf("Expected success code 200, got %v", registerResponse["code"])
	}

	// Step 2: Login with the registered user
	loginPayload := uservo.LoginRequest{
		UserAccount:  "e2etest@example.com",
		UserPassword: "password123",
	}

	jsonBody, err = json.Marshal(loginPayload)
	if err != nil {
		t.Fatalf("Failed to marshal login payload: %v", err)
	}

	req, err = http.NewRequest("POST", "/v1/user/login", bytes.NewBuffer(jsonBody))
	if err != nil {
		t.Fatalf("Failed to create login request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert login success
	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var loginResponse map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &loginResponse)
	if err != nil {
		t.Fatalf("Failed to unmarshal login response: %v", err)
	}

	if loginResponse["code"] != float64(200) {
		t.Errorf("Expected success code 200, got %v", loginResponse["code"])
	}

	// Extract tokens
	data, ok := loginResponse["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected data in login response")
	}

	tokens, ok := data["tokens"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected tokens in login response data")
	}

	accessToken, ok := tokens["access_token"].(string)
	if !ok || accessToken == "" {
		t.Errorf("Expected access_token in response")
	}

	refreshToken, ok := tokens["refresh_token"].(string)
	if !ok || refreshToken == "" {
		t.Errorf("Expected refresh_token in response")
	}

	t.Logf("Successfully completed user flow: register -> login -> tokens received")
}
