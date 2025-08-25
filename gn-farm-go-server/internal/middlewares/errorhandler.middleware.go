package middlewares

import (
	"fmt"
	"runtime/debug"
	"strings"
	"time"

	"gn-farm-go-server/global"
	"gn-farm-go-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// CustomError represents a custom application error
type CustomError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

func (e *CustomError) Error() string {
	return e.Message
}

// ErrorHandler provides comprehensive error handling
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// Log panic with stack trace
				stack := debug.Stack()
				global.Logger.Error("Panic recovered",
					zap.Any("error", err),
					zap.String("stack", string(stack)),
					zap.String("path", c.Request.URL.Path),
					zap.String("method", c.Request.Method),
				)

				// Return internal server error
				response.ErrorResponse(c, response.ErrCodeInternalServerError, "Internal server error")
				c.Abort()
			}
		}()

		c.Next()

		// Handle errors after request processing
		if len(c.Errors) > 0 {
			err := c.Errors.Last()
			handleError(c, err.Err)
		}
	}
}

// handleError processes different types of errors
func handleError(c *gin.Context, err error) {
	requestID := c.GetHeader("X-Request-ID")

	// Log error details
	logError(c, err, requestID)

	// Handle different error types
	switch e := err.(type) {
	case *CustomError:
		response.ErrorResponse(c, e.Code, e.Message)
	case *gin.Error:
		if e.Type == gin.ErrorTypePublic {
			response.ErrorResponse(c, response.ErrCodeParamInvalid, e.Error())
		} else {
			response.ErrorResponse(c, response.ErrCodeInternalServerError, "Internal server error")
		}
	default:
		// Check for common error patterns
		statusCode, message := categorizeError(err)
		response.ErrorResponse(c, statusCode, message)
	}
}

// logError logs error details with context
func logError(c *gin.Context, err error, requestID string) {
	errorLog := map[string]interface{}{
		"error":      err.Error(),
		"request_id": requestID,
		"method":     c.Request.Method,
		"path":       c.Request.URL.Path,
		"client_ip":  c.ClientIP(),
		"user_agent": c.Request.UserAgent(),
		"timestamp":  time.Now().Format(time.RFC3339),
	}

	// Add user context if available
	if userID, exists := c.Get("user_id"); exists {
		errorLog["user_id"] = userID
	}

	global.Logger.Error("Request Error", zap.Any("error_details", errorLog))
}

// categorizeError categorizes errors and returns appropriate status codes
func categorizeError(err error) (int, string) {
	errMsg := strings.ToLower(err.Error())

	// Database errors
	if strings.Contains(errMsg, "no rows in result set") {
		return response.ErrCodeNotFound, "Resource not found"
	}
	if strings.Contains(errMsg, "duplicate key") || strings.Contains(errMsg, "unique constraint") {
		return response.ErrCodeParamInvalid, "Resource already exists"
	}
	if strings.Contains(errMsg, "foreign key constraint") {
		return response.ErrCodeParamInvalid, "Invalid reference"
	}

	// Validation errors
	if strings.Contains(errMsg, "validation failed") || strings.Contains(errMsg, "invalid input") {
		return response.ErrCodeParamInvalid, "Invalid input data"
	}

	// Authentication errors
	if strings.Contains(errMsg, "unauthorized") || strings.Contains(errMsg, "invalid token") {
		return response.ErrCodeAuthFailed, "Authentication failed"
	}
	if strings.Contains(errMsg, "forbidden") || strings.Contains(errMsg, "access denied") {
		return response.ErrCodeForbidden, "Access denied"
	}

	// Network/timeout errors
	if strings.Contains(errMsg, "timeout") || strings.Contains(errMsg, "deadline exceeded") {
		return response.ErrCodeInternalServerError, "Request timeout"
	}

	// Default to internal server error
	return response.ErrCodeInternalServerError, "Internal server error"
}

// NewCustomError creates a new custom error
func NewCustomError(code int, message string, details ...string) *CustomError {
	detail := ""
	if len(details) > 0 {
		detail = details[0]
	}
	return &CustomError{
		Code:    code,
		Message: message,
		Details: detail,
	}
}

// ValidationError creates a validation error
func ValidationError(field, message string) *CustomError {
	return NewCustomError(
		response.ErrCodeParamInvalid,
		fmt.Sprintf("Validation failed for field '%s': %s", field, message),
	)
}

// NotFoundError creates a not found error
func NotFoundError(resource string) *CustomError {
	return NewCustomError(
		response.ErrCodeNotFound,
		fmt.Sprintf("%s not found", resource),
	)
}

// ConflictError creates a conflict error
func ConflictError(resource string) *CustomError {
	return NewCustomError(
		response.ErrCodeParamInvalid,
		fmt.Sprintf("%s already exists", resource),
	)
}
