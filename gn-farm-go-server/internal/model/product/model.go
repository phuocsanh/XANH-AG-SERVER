// Package product - Chứa các model liên quan đến sản phẩm
// Định nghĩa cấu trúc dữ liệu cho quản lý sản phẩm, giá cả, loại sản phẩm
package product

import (
	"encoding/json"
	"time"
)

// Product - Model chứa toàn bộ thông tin sản phẩm
// Sử dụng cho các chức năng CRUD sản phẩm trong hệ thống quản lý kho hàng
type Product struct {
	// ID - Mã định danh duy nhất của sản phẩm
	ID          int32           `json:"id"`
	// Name - Tên sản phẩm hiển thị cho khách hàng
	Name        string          `json:"name"`
	// Price - Giá bán của sản phẩm (dạng text để hỗ trợ decimal chính xác)
	Price       string          `json:"price"`
	// Type - Loại sản phẩm chính (liên kết với ProductType)
	Type        int32           `json:"type"`
	// Thumb - Ảnh đại diện chính của sản phẩm (URL)
	Thumb       string          `json:"thumb"`
	// Pictures - Danh sách các ảnh bổ sung của sản phẩm (URLs)
	Pictures    []string        `json:"pictures"`
	// Videos - Danh sách các video giới thiệu sản phẩm (URLs)
	Videos      []string        `json:"videos"`
	// Description - Mô tả chi tiết sản phẩm
	Description string          `json:"description"`
	// Quantity - Số lượng tồn kho hiện tại
	Quantity    int32           `json:"quantity"`
	// SubTypes - Danh sách các phân loại phụ của sản phẩm
	SubTypes    []int32         `json:"sub_types"`
	// Discount - Phần trăm giảm giá (dạng text)
	Discount    string          `json:"discount"`
	// Attributes - Các thuộc tính đặc biệt của sản phẩm (JSON format)
	// Ví dụ: kích thước, màu sắc, chất liệu, etc.
	Attributes  json.RawMessage `json:"attributes"`
	// IsDraft - Sản phẩm có đang ở trạng thái nháp không
	IsDraft     bool            `json:"is_draft"`
	// IsPublished - Sản phẩm đã được xuất bản và hiển thị công khai chưa
	IsPublished bool            `json:"is_published"`
	// CreatedAt - Thời gian tạo sản phẩm
	CreatedAt   time.Time       `json:"created_at"`
	// UpdatedAt - Thời gian cập nhật sản phẩm lần cuối
	UpdatedAt   time.Time       `json:"updated_at"`
}
