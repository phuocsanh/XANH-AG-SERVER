package common

import (
	"fmt"
	"gn-farm-go-server/pkg/response"
)

// Domain-specific error types
type (
	// ValidationError represents input validation errors
	ValidationError struct {
		Field   string `json:"field"`
		Message string `json:"message"`
		Code    int    `json:"code"`
	}

	// BusinessError represents business logic errors
	BusinessError struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Details string `json:"details,omitempty"`
	}

	// DatabaseError represents database operation errors
	DatabaseError struct {
		Code      int    `json:"code"`
		Message   string `json:"message"`
		Operation string `json:"operation"`
		Table     string `json:"table,omitempty"`
	}

	// AuthError represents authentication/authorization errors
	AuthError struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Action  string `json:"action,omitempty"`
	}
)

// Error implementations
func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation failed for field '%s': %s", e.Field, e.Message)
}

func (e *BusinessError) Error() string {
	return e.Message
}

func (e *DatabaseError) Error() string {
	return fmt.Sprintf("database %s failed: %s", e.Operation, e.Message)
}

func (e *AuthError) Error() string {
	return e.Message
}

// Error constructors
func NewValidationError(field, message string) *ValidationError {
	return &ValidationError{
		Field:   field,
		Message: message,
		Code:    response.ErrCodeParamInvalid,
	}
}

func NewBusinessError(code int, message string, details ...string) *BusinessError {
	detail := ""
	if len(details) > 0 {
		detail = details[0]
	}
	return &BusinessError{
		Code:    code,
		Message: message,
		Details: detail,
	}
}

func NewDatabaseError(operation, message string, table ...string) *DatabaseError {
	tbl := ""
	if len(table) > 0 {
		tbl = table[0]
	}
	return &DatabaseError{
		Code:      response.ErrCodeInternalServerError,
		Message:   message,
		Operation: operation,
		Table:     tbl,
	}
}

func NewAuthError(message string, action ...string) *AuthError {
	act := ""
	if len(action) > 0 {
		act = action[0]
	}
	return &AuthError{
		Code:    response.ErrCodeAuthFailed,
		Message: message,
		Action:  act,
	}
}

// Common error instances
var (
	// User errors
	ErrUserNotFound     = NewBusinessError(response.ErrCodeNotFound, "User not found")
	ErrUserExists       = NewBusinessError(response.ErrCodeParamInvalid, "User already exists")
	ErrInvalidPassword  = NewBusinessError(response.ErrCodeAuthFailed, "Invalid password")
	ErrUserInactive     = NewBusinessError(response.ErrCodeAuthFailed, "User account is inactive")

	// Product errors
	ErrProductNotFound    = NewBusinessError(response.ErrCodeNotFound, "Product not found")
	ErrProductExists      = NewBusinessError(response.ErrCodeParamInvalid, "Product already exists")
	ErrInvalidProductData = NewBusinessError(response.ErrCodeParamInvalid, "Invalid product data")
	ErrProductOutOfStock  = NewBusinessError(response.ErrCodeParamInvalid, "Product is out of stock")

	// Authentication errors
	ErrInvalidToken     = NewAuthError("Invalid or expired token")
	ErrTokenExpired     = NewAuthError("Token has expired")
	ErrInsufficientRole = NewAuthError("Insufficient permissions")
	ErrAccountLocked    = NewAuthError("Account is locked")

	// Validation errors
	ErrRequiredField = func(field string) *ValidationError {
		return NewValidationError(field, "is required")
	}
	ErrInvalidFormat = func(field string) *ValidationError {
		return NewValidationError(field, "has invalid format")
	}
	ErrInvalidLength = func(field string, min, max int) *ValidationError {
		return NewValidationError(field, fmt.Sprintf("length must be between %d and %d", min, max))
	}

	// Database errors
	ErrDatabaseConnection = NewDatabaseError("connection", "Failed to connect to database")
	ErrDatabaseQuery      = NewDatabaseError("query", "Database query failed")
	ErrDatabaseTransaction = NewDatabaseError("transaction", "Database transaction failed")
)

// Error checking utilities
func IsValidationError(err error) bool {
	_, ok := err.(*ValidationError)
	return ok
}

func IsBusinessError(err error) bool {
	_, ok := err.(*BusinessError)
	return ok
}

func IsDatabaseError(err error) bool {
	_, ok := err.(*DatabaseError)
	return ok
}

func IsAuthError(err error) bool {
	_, ok := err.(*AuthError)
	return ok
}

// GetErrorCode extracts error code from custom errors
func GetErrorCode(err error) int {
	switch e := err.(type) {
	case *ValidationError:
		return e.Code
	case *BusinessError:
		return e.Code
	case *DatabaseError:
		return e.Code
	case *AuthError:
		return e.Code
	default:
		return response.ErrCodeInternalServerError
	}
}

// WrapError wraps an error with additional context
func WrapError(err error, message string) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", message, err)
}

// ErrorChain represents a chain of errors for better debugging
type ErrorChain struct {
	errors []error
}

func NewErrorChain() *ErrorChain {
	return &ErrorChain{
		errors: make([]error, 0),
	}
}

func (ec *ErrorChain) Add(err error) *ErrorChain {
	if err != nil {
		ec.errors = append(ec.errors, err)
	}
	return ec
}

func (ec *ErrorChain) HasErrors() bool {
	return len(ec.errors) > 0
}

func (ec *ErrorChain) Error() string {
	if len(ec.errors) == 0 {
		return ""
	}
	if len(ec.errors) == 1 {
		return ec.errors[0].Error()
	}

	result := "multiple errors occurred: "
	for i, err := range ec.errors {
		if i > 0 {
			result += "; "
		}
		result += err.Error()
	}
	return result
}

func (ec *ErrorChain) Errors() []error {
	return ec.errors
}

// RetryableError indicates if an error is retryable
type RetryableError struct {
	Err       error
	Retryable bool
}

func (re *RetryableError) Error() string {
	return re.Err.Error()
}

func NewRetryableError(err error, retryable bool) *RetryableError {
	return &RetryableError{
		Err:       err,
		Retryable: retryable,
	}
}

func IsRetryable(err error) bool {
	if re, ok := err.(*RetryableError); ok {
		return re.Retryable
	}
	return false
}

// IsOperationalError checks if error is operational (expected) or system error
func IsOperationalError(err error) bool {
	switch err.(type) {
	case *ValidationError, *BusinessError, *AuthError:
		return true
	default:
		return false
	}
}
