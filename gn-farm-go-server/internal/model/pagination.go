package model

// PaginationRequest định nghĩa request chung cho pagination
type PaginationRequest struct {
	Page     int    `json:"page" form:"page"`           // Trang hiện tại (bắt đầu từ 1)
	PageSize int    `json:"page_size" form:"page_size"` // Số lượng items trên mỗi trang
	Search   string `json:"search" form:"search"`       // Từ khóa tìm kiếm (optional)
}

// PaginationMeta chứa metadata cho pagination
type PaginationMeta struct {
	Total      int64 `json:"total"`       // Tổng số items
	Page       int   `json:"page"`        // Trang hiện tại
	PageSize   int   `json:"page_size"`   // Số lượng items trên mỗi trang
	TotalPages int   `json:"total_pages"` // Tổng số trang
	HasNext    bool  `json:"has_next"`    // Có trang tiếp theo không
	HasPrev    bool  `json:"has_prev"`    // Có trang trước không
}

// PaginatedResponse định nghĩa response chung cho pagination
type PaginatedResponse[T any] struct {
	Data       []T            `json:"data"`       // Dữ liệu chính
	Pagination PaginationMeta `json:"pagination"` // Metadata pagination
	Message    string         `json:"message,omitempty"`
}

// NewPaginatedResponse tạo response với pagination
func NewPaginatedResponse[T any](data []T, input PaginationRequest, total int64, message string) PaginatedResponse[T] {
	totalPages := int((total + int64(input.PageSize) - 1) / int64(input.PageSize))

	return PaginatedResponse[T]{
		Data: data,
		Pagination: PaginationMeta{
			Total:      total,
			Page:       input.Page,
			PageSize:   input.PageSize,
			TotalPages: totalPages,
			HasNext:    input.Page < totalPages,
			HasPrev:    input.Page > 1,
		},
		Message: message,
	}
}

// CalculateOffset tính toán offset từ page và pageSize
func (p *PaginationRequest) CalculateOffset() int {
	return (p.Page - 1) * p.PageSize
}

// Validate và set default values cho pagination request
func (p *PaginationRequest) Validate() {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 || p.PageSize > 100 {
		p.PageSize = 10 // Default page size
	}
}
