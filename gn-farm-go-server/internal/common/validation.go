package common

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"
)

// Validation constants
const (
	MinPasswordLength = 8
	MaxPasswordLength = 128
	MinUsernameLength = 3
	MaxUsernameLength = 50
	MaxEmailLength    = 254
	MaxNameLength     = 100
)

// Regular expressions for validation
var (
	EmailRegex    = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	PhoneRegex    = regexp.MustCompile(`^\+?[1-9]\d{1,14}$`)
	UsernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	SlugRegex     = regexp.MustCompile(`^[a-z0-9-]+$`)
)

// ValidationResult represents the result of a validation
type ValidationResult struct {
	IsValid bool
	Errors  []ValidationError
}

// AddError adds a validation error
func (vr *ValidationResult) AddError(field, message string) {
	vr.IsValid = false
	vr.Errors = append(vr.Errors, ValidationError{
		Field:   field,
		Message: message,
		Code:    400,
	})
}

// HasErrors checks if there are validation errors
func (vr *ValidationResult) HasErrors() bool {
	return len(vr.Errors) > 0
}

// GetFirstError returns the first validation error
func (vr *ValidationResult) GetFirstError() *ValidationError {
	if len(vr.Errors) > 0 {
		return &vr.Errors[0]
	}
	return nil
}

// Validator interface for custom validators
type Validator interface {
	Validate() *ValidationResult
}

// String validation functions
func ValidateRequired(value, fieldName string) *ValidationError {
	if strings.TrimSpace(value) == "" {
		return NewValidationError(fieldName, "is required")
	}
	return nil
}

func ValidateLength(value, fieldName string, min, max int) *ValidationError {
	length := len(strings.TrimSpace(value))
	if length < min || length > max {
		return NewValidationError(fieldName, fmt.Sprintf("length must be between %d and %d characters", min, max))
	}
	return nil
}

func ValidateMinLength(value, fieldName string, min int) *ValidationError {
	if len(strings.TrimSpace(value)) < min {
		return NewValidationError(fieldName, fmt.Sprintf("must be at least %d characters long", min))
	}
	return nil
}

func ValidateMaxLength(value, fieldName string, max int) *ValidationError {
	if len(strings.TrimSpace(value)) > max {
		return NewValidationError(fieldName, fmt.Sprintf("must be no more than %d characters long", max))
	}
	return nil
}

// Email validation
func ValidateEmail(email string) *ValidationError {
	email = strings.TrimSpace(email)
	if email == "" {
		return NewValidationError("email", "is required")
	}
	if len(email) > MaxEmailLength {
		return NewValidationError("email", fmt.Sprintf("must be no more than %d characters long", MaxEmailLength))
	}
	if !EmailRegex.MatchString(email) {
		return NewValidationError("email", "has invalid format")
	}
	return nil
}

// Password validation
func ValidatePassword(password string) *ValidationError {
	if password == "" {
		return NewValidationError("password", "is required")
	}
	if len(password) < MinPasswordLength {
		return NewValidationError("password", fmt.Sprintf("must be at least %d characters long", MinPasswordLength))
	}
	if len(password) > MaxPasswordLength {
		return NewValidationError("password", fmt.Sprintf("must be no more than %d characters long", MaxPasswordLength))
	}
	
	// Check for at least one uppercase letter
	hasUpper := false
	hasLower := false
	hasDigit := false
	hasSpecial := false
	
	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasDigit = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}
	
	if !hasUpper {
		return NewValidationError("password", "must contain at least one uppercase letter")
	}
	if !hasLower {
		return NewValidationError("password", "must contain at least one lowercase letter")
	}
	if !hasDigit {
		return NewValidationError("password", "must contain at least one digit")
	}
	if !hasSpecial {
		return NewValidationError("password", "must contain at least one special character")
	}
	
	return nil
}

// Username validation
func ValidateUsername(username string) *ValidationError {
	username = strings.TrimSpace(username)
	if username == "" {
		return NewValidationError("username", "is required")
	}
	if err := ValidateLength(username, "username", MinUsernameLength, MaxUsernameLength); err != nil {
		return err
	}
	if !UsernameRegex.MatchString(username) {
		return NewValidationError("username", "can only contain letters, numbers, underscores, and hyphens")
	}
	return nil
}

// Phone validation
func ValidatePhone(phone string) *ValidationError {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return nil // Phone is optional in most cases
	}
	if !PhoneRegex.MatchString(phone) {
		return NewValidationError("phone", "has invalid format")
	}
	return nil
}

// Numeric validation
func ValidatePositiveInt(value int32, fieldName string) *ValidationError {
	if value <= 0 {
		return NewValidationError(fieldName, "must be a positive number")
	}
	return nil
}

func ValidateNonNegativeInt(value int32, fieldName string) *ValidationError {
	if value < 0 {
		return NewValidationError(fieldName, "must be a non-negative number")
	}
	return nil
}

func ValidateRange(value, min, max int32, fieldName string) *ValidationError {
	if value < min || value > max {
		return NewValidationError(fieldName, fmt.Sprintf("must be between %d and %d", min, max))
	}
	return nil
}

// URL validation
func ValidateURL(url, fieldName string) *ValidationError {
	url = strings.TrimSpace(url)
	if url == "" {
		return nil // URL is optional in most cases
	}
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		return NewValidationError(fieldName, "must be a valid URL starting with http:// or https://")
	}
	return nil
}

// Slug validation (for SEO-friendly URLs)
func ValidateSlug(slug, fieldName string) *ValidationError {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return NewValidationError(fieldName, "is required")
	}
	if !SlugRegex.MatchString(slug) {
		return NewValidationError(fieldName, "can only contain lowercase letters, numbers, and hyphens")
	}
	if strings.HasPrefix(slug, "-") || strings.HasSuffix(slug, "-") {
		return NewValidationError(fieldName, "cannot start or end with a hyphen")
	}
	return nil
}

// Enum validation
func ValidateEnum(value string, validValues []string, fieldName string) *ValidationError {
	for _, valid := range validValues {
		if value == valid {
			return nil
		}
	}
	return NewValidationError(fieldName, fmt.Sprintf("must be one of: %s", strings.Join(validValues, ", ")))
}

// Composite validation functions
func ValidateUserRegistration(email, password, username string) *ValidationResult {
	result := &ValidationResult{IsValid: true}
	
	if err := ValidateEmail(email); err != nil {
		result.AddError(err.Field, err.Message)
	}
	
	if err := ValidatePassword(password); err != nil {
		result.AddError(err.Field, err.Message)
	}
	
	if err := ValidateUsername(username); err != nil {
		result.AddError(err.Field, err.Message)
	}
	
	return result
}

func ValidateProductData(name, description string, price, quantity int32) *ValidationResult {
	result := &ValidationResult{IsValid: true}
	
	if err := ValidateRequired(name, "name"); err != nil {
		result.AddError(err.Field, err.Message)
	} else if err := ValidateMaxLength(name, "name", MaxNameLength); err != nil {
		result.AddError(err.Field, err.Message)
	}
	
	if description != "" {
		if err := ValidateMaxLength(description, "description", 1000); err != nil {
			result.AddError(err.Field, err.Message)
		}
	}
	
	if err := ValidatePositiveInt(price, "price"); err != nil {
		result.AddError(err.Field, err.Message)
	}
	
	if err := ValidateNonNegativeInt(quantity, "quantity"); err != nil {
		result.AddError(err.Field, err.Message)
	}
	
	return result
}

// Sanitization functions
func SanitizeString(input string) string {
	// Remove leading/trailing whitespace
	input = strings.TrimSpace(input)
	
	// Replace multiple spaces with single space
	re := regexp.MustCompile(`\s+`)
	input = re.ReplaceAllString(input, " ")
	
	return input
}

func SanitizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func SanitizeUsername(username string) string {
	return strings.ToLower(strings.TrimSpace(username))
}

// Validation middleware helper
func ValidateStruct(v Validator) *ValidationResult {
	return v.Validate()
}
