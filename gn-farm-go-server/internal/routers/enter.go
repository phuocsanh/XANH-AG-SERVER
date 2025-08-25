// Package routers - Quản lý tổng hợp tất cả các router group trong hệ thống
package routers

import (
	"gn-farm-go-server/internal/routers/manage"
	"gn-farm-go-server/internal/routers/product"
	"gn-farm-go-server/internal/routers/user"
)

// RouterGroup - Cấu trúc tổng hợp tất cả các nhóm router trong ứng dụng
// Bao gồm:
// - User: Quản lý routes liên quan đến người dùng (đăng nhập, đăng ký, profile, v.v.)
// - Manage: Quản lý routes cho admin (quản lý kho, inventory, báo cáo)
// - Product: Quản lý routes cho sản phẩm (CRUD, tìm kiếm, phân loại)
type RouterGroup struct {
	// User - Nhóm router cho các chức năng người dùng
	User    user.UserRouterGroup
	// Manage - Nhóm router cho các chức năng quản lý admin
	Manage  manage.ManageRouterGroup
	// Product - Router cho các chức năng sản phẩm
	Product product.ProductRouter
}

// RouterGroupApp - Instance toàn cục của RouterGroup để sử dụng trong toàn bộ ứng dụng
// Khởi tạo tất cả các router group và cung cấp điểm truy cập duy nhất
var RouterGroupApp = new(RouterGroup)
