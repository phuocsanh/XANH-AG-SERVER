package middlewares

import (
	"bytes"
	"encoding/json"
	"io"
	"time"

	"gn-farm-go-server/global"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// LoggingMiddleware provides structured logging for HTTP requests
func LoggingMiddleware() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		// Create structured log entry
		logEntry := map[string]interface{}{
			"timestamp":    param.TimeStamp.Format(time.RFC3339),
			"method":       param.Method,
			"path":         param.Path,
			"status_code":  param.StatusCode,
			"latency":      param.Latency.String(),
			"client_ip":    param.ClientIP,
			"user_agent":   param.Request.UserAgent(),
			"request_id":   param.Request.Header.Get("X-Request-ID"),
		}

		// Add error information if present
		if param.ErrorMessage != "" {
			logEntry["error"] = param.ErrorMessage
		}

		// Log based on status code
		if param.StatusCode >= 500 {
			global.Logger.Error("HTTP Request", zap.Any("request", logEntry))
		} else if param.StatusCode >= 400 {
			global.Logger.Warn("HTTP Request", zap.Any("request", logEntry))
		} else {
			global.Logger.Info("HTTP Request", zap.Any("request", logEntry))
		}

		return ""
	})
}

// RequestResponseLoggingMiddleware logs request and response details
func RequestResponseLoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		
		// Generate request ID if not present
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
			c.Header("X-Request-ID", requestID)
		}

		// Log request
		logRequest(c, requestID)

		// Capture response
		blw := &bodyLogWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
		c.Writer = blw

		// Process request
		c.Next()

		// Log response
		latency := time.Since(start)
		logResponse(c, requestID, latency, blw.body.String())
	}
}

// bodyLogWriter captures response body for logging
type bodyLogWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w bodyLogWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// logRequest logs incoming request details
func logRequest(c *gin.Context, requestID string) {
	// Read request body
	var requestBody string
	if c.Request.Body != nil {
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err == nil {
			requestBody = string(bodyBytes)
			// Restore request body for further processing
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		}
	}

	// Mask sensitive data in request body
	maskedBody := maskSensitiveData(requestBody)

	logEntry := map[string]interface{}{
		"type":        "request",
		"request_id":  requestID,
		"method":      c.Request.Method,
		"path":        c.Request.URL.Path,
		"query":       c.Request.URL.RawQuery,
		"headers":     maskSensitiveHeaders(c.Request.Header),
		"body":        maskedBody,
		"client_ip":   c.ClientIP(),
		"user_agent":  c.Request.UserAgent(),
		"timestamp":   time.Now().Format(time.RFC3339),
	}

	global.Logger.Info("Incoming Request", zap.Any("request", logEntry))
}

// logResponse logs outgoing response details
func logResponse(c *gin.Context, requestID string, latency time.Duration, responseBody string) {
	// Mask sensitive data in response body
	maskedBody := maskSensitiveData(responseBody)

	logEntry := map[string]interface{}{
		"type":        "response",
		"request_id":  requestID,
		"status_code": c.Writer.Status(),
		"latency":     latency.String(),
		"headers":     maskSensitiveHeaders(c.Writer.Header()),
		"body":        maskedBody,
		"timestamp":   time.Now().Format(time.RFC3339),
	}

	// Log based on status code
	if c.Writer.Status() >= 500 {
		global.Logger.Error("Outgoing Response", zap.Any("response", logEntry))
	} else if c.Writer.Status() >= 400 {
		global.Logger.Warn("Outgoing Response", zap.Any("response", logEntry))
	} else {
		global.Logger.Info("Outgoing Response", zap.Any("response", logEntry))
	}
}

// maskSensitiveData masks sensitive information in JSON strings
func maskSensitiveData(data string) string {
	if data == "" {
		return ""
	}

	// Try to parse as JSON
	var jsonData map[string]interface{}
	if err := json.Unmarshal([]byte(data), &jsonData); err != nil {
		// If not JSON, return truncated string
		if len(data) > 1000 {
			return data[:1000] + "... [truncated]"
		}
		return data
	}

	// Mask sensitive fields
	sensitiveFields := []string{
		"password", "token", "secret", "key", "authorization",
		"user_password", "access_token", "refresh_token",
	}

	for _, field := range sensitiveFields {
		if _, exists := jsonData[field]; exists {
			jsonData[field] = "***MASKED***"
		}
	}

	// Convert back to JSON
	maskedBytes, err := json.Marshal(jsonData)
	if err != nil {
		return "***ERROR_PARSING_JSON***"
	}

	return string(maskedBytes)
}

// maskSensitiveHeaders masks sensitive headers
func maskSensitiveHeaders(headers map[string][]string) map[string][]string {
	masked := make(map[string][]string)
	sensitiveHeaders := map[string]bool{
		"authorization": true,
		"cookie":        true,
		"x-api-key":     true,
		"x-auth-token":  true,
	}

	for key, values := range headers {
		if sensitiveHeaders[key] {
			masked[key] = []string{"***MASKED***"}
		} else {
			masked[key] = values
		}
	}

	return masked
}

// generateRequestID generates a unique request ID
func generateRequestID() string {
	// Simple implementation - in production, use UUID or similar
	return time.Now().Format("20060102150405") + "-" + randomString(8)
}

// randomString generates a random string of specified length
func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}
