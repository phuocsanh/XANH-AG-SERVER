//####################################################################
// RESPONSE PACKAGE - XỨ LÝ HTTP RESPONSE CHO GN FARM API
// Package này cung cấp các hàm tiện ích để trả về HTTP response
// theo chuẩn API RESTful với format JSON nhất quán
//
// Chức năng chính:
// - Response thành công với data
// - Response lỗi với error message
// - Response với pagination
// - Response với single item hoặc multiple items
// - Mapping HTTP status codes chuẩn
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// // Constants for error codes were moved to httpStatusCode.go
// const (
// 	ErrCodeSuccess             = 200
// 	ErrCodeParamInvalid       = 400
// 	ErrCodeUnauthorized       = 401
// 	ErrCodeForbidden          = 403
// 	ErrCodeNotFound           = 404
// 	ErrCodeInternalServerError = 500
// )

// // Map for error messages was moved to httpStatusCode.go
// var msg = map[int]string{
// 	ErrCodeSuccess:             "Success",
// 	ErrCodeParamInvalid:       "Invalid parameters",
// 	ErrCodeUnauthorized:       "Unauthorized",
// 	ErrCodeForbidden:          "Forbidden",
// 	ErrCodeNotFound:           "Not found",
// 	ErrCodeInternalServerError: "Internal server error",
// }

// ===== CÁC CẤU TRÚC DỮU LIỆU RESPONSE =====

// ResponseData - Cấu trúc chuẩn cho tất cả API response thành công
type ResponseData struct {
	Code    int         `json:"code"`    // Mã trạng thái (200, 201, etc.)
	Message string      `json:"message"` // Thông báo mô tả
	Data    interface{} `json:"data"`    // Dữ liệu trả về (object, array, null)
}

// ErrorResponseData - Cấu trúc chuẩn cho API response lỗi
type ErrorResponseData struct {
	Code   int         `json:"code"`   // Mã lỗi (400, 401, 500, etc.)
	Err    string      `json:"error"`  // Thông báo lỗi ngắn gọn
	Detail interface{} `json:"detail"` // Chi tiết lỗi (validation errors, stack trace)
}

// ===== CÁC HÀM XỨ LÝ RESPONSE =====

// SuccessResponse - Trả về response thành công với data
// @param c *gin.Context - Gin context để trả về JSON
// @param code int - Mã trạng thái thành công (thường là 200, 201)
// @param data interface{} - Dữ liệu cần trả về
func SuccessResponse(c *gin.Context, code int, data interface{}) {
	c.JSON(http.StatusOK, ResponseData{
		Code:    code,
		Message: msg[code], // Sử dụng message từ httpStatusCode.go
		Data:    data,
	})
}

// ErrorResponse - Trả về response lỗi với message tùy chỉnh
// @param c *gin.Context - Gin context để trả về JSON  
// @param code int - Mã lỗi (400, 401, 500, etc.)
// @param message string - Thông báo lỗi (nếu rỗng sẽ dùng default)
func ErrorResponse(c *gin.Context, code int, message string) {
	if message == "" {
		message = msg[code] // Sử dụng default message nếu không cung cấp
	}
	
	// Mapping mã lỗi nội bộ sang HTTP status code chuẩn
	httpStatus := http.StatusOK
	switch code {
	case ErrCodeParamInvalid:
		httpStatus = http.StatusBadRequest      // 400
	case ErrCodeUnauthorized:
		httpStatus = http.StatusUnauthorized    // 401  
	case ErrCodeForbidden:
		httpStatus = http.StatusForbidden       // 403
	case ErrCodeNotFound:
		httpStatus = http.StatusNotFound        // 404
	case ErrCodeInternalServerError:
		httpStatus = http.StatusInternalServerError // 500
	default:
		// Nếu là HTTP status code hợp lệ thì dùng trực tiếp
		if code >= 100 && code < 600 {
			httpStatus = code
		} else {
			httpStatus = http.StatusBadRequest  // Mặc định là 400
		}
	}
	
	c.JSON(httpStatus, ResponseData{
		Code:    code,
		Message: message,
		Data:    nil,
	})
}

// SuccessResponseWithItem trả về response với một item
func SuccessResponseWithItem(c *gin.Context, code int, item interface{}) {
	data := gin.H{
		"item": item,
	}
	SuccessResponse(c, code, data)
}

// SuccessResponseWithItems trả về response với danh sách items
func SuccessResponseWithItems(c *gin.Context, code int, items interface{}) {
	data := gin.H{
		"items": items,
	}
	SuccessResponse(c, code, data)
}

// SuccessResponseWithPagination trả về response với danh sách items và thông tin phân trang
func SuccessResponseWithPagination(c *gin.Context, code int, items interface{}, pagination interface{}) {
	data := gin.H{
		"items":      items,
		"pagination": pagination,
	}
	SuccessResponse(c, code, data)
}
