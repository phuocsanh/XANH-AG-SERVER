// Package product - Chứa các router công khai liên quan đến sản phẩm
package product

// ProductRouterGroup - Nhóm các router sản phẩm dành cho người dùng cuối
// Chứa các API công khai không cần xác thực cho:
// - Xem thông tin sản phẩm
// - Tìm kiếm và lọc sản phẩm
// - Xem các loại và phân loại sản phẩm
type ProductRouterGroup struct {
	// ProductRouter - Router xử lý các API sản phẩm công khai
	ProductRouter
}

// ProductRouterGroupApp - Instance toàn cục của ProductRouterGroup
// Sử dụng để truy cập các router sản phẩm từ các phần khác của ứng dụng
var ProductRouterGroupApp = new(ProductRouterGroup) 