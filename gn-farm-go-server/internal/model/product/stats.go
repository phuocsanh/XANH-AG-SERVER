// Package product - Model cho thống kê sản phẩm
package product

// ProductStats - Model định nghĩa cấu trúc cho thống kê tổng quan về sản phẩm
// Sử dụng trong dashboard admin và báo cáo kinh doanh
type ProductStats struct {
	// TotalProducts - Tổng số sản phẩm trong hệ thống
	TotalProducts      int64       `json:"total_products"`
	// InStockProducts - Số sản phẩm còn hàng (quantity > 0)
	InStockProducts    int64       `json:"in_stock_products"`
	// OutOfStockProducts - Số sản phẩm hết hàng (quantity = 0)
	OutOfStockProducts int64       `json:"out_of_stock_products"`
	// TotalProductsSold - Tổng số sản phẩm đã bán được
	TotalProductsSold  int64       `json:"total_products_sold"`
	// AverageRating - Điểm đánh giá trung bình của tất cả sản phẩm
	AverageRating      float64     `json:"average_rating"`
	// MinPrice - Giá thấp nhất trong hệ thống
	// Sử dụng interface{} để hỗ trợ cả null và giá trị thực tế
	MinPrice           interface{} `json:"min_price"`
	// MaxPrice - Giá cao nhất trong hệ thống  
	// Sử dụng interface{} để hỗ trợ cả null và giá trị thực tế
	MaxPrice           interface{} `json:"max_price"`
	// AvgPrice - Giá trung bình của tất cả sản phẩm
	AvgPrice           float64     `json:"avg_price"`
	// TotalCategories - Tổng số danh mục/loại sản phẩm
	TotalCategories    int64       `json:"total_categories"`
}
