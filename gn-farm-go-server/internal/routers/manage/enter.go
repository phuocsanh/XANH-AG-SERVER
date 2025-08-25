//####################################################################
// MANAGE ROUTER GROUP - NHÓM ROUTER QUẢN LÝ ADMIN
// Package này tổ chức các router cho chức năng quản lý dành cho admin
// 
// Chức năng chính:
// - Tổ chức các router management theo modules
// - Phân quyền admin và staff cho các chức năng quản lý
// - Cung cấp interface thống nhất cho tất cả management operations
// - Quản lý access control cho admin functions
//
// Các router modules bao gồm:
// - UserRouter: Quản lý người dùng (activate, deactivate, permissions)
// - AdminRouter: Xác thực và operations dành cho admin
// - ProductManageRouter: Quản lý sản phẩm (CRUD, approval, pricing)
// - InventoryManageRouter: Quản lý kho (import/export, stock, reports)
//
// Phân quyền:
// - Admin: Full access tất cả management functions
// - Staff: Limited access theo role-based permissions
// - Manager: Advanced access cho business operations
//
// Security features:
// - JWT authentication required
// - Role-based access control (RBAC)
// - Audit logging cho tất cả admin actions
// - IP whitelist cho sensitive operations
//
// Tác giả: GN Farm Development Team
// Phiên bản: 1.0
//####################################################################

// Package manage - Chứa các router cho chức năng quản lý admin
package manage

// ===== MANAGE ROUTER GROUP STRUCT =====
// ManageRouterGroup - Nhóm tổng hợp các router quản lý dành cho admin
// Bao gồm tất cả các chức năng quản trị hệ thống:
// - UserRouter: Quản lý người dùng (kích hoạt, vô hiệu hóa, phân quyền)
// - AdminRouter: Quản lý admin (authentication, admin operations)
// - ProductManageRouter: Quản lý sản phẩm (CRUD, phê duyệt, quản lý giá)
// - InventoryManageRouter: Quản lý kho hàng (nhập/xuất, tồn kho, báo cáo)
type ManageRouterGroup struct {
	// ===== USER MANAGEMENT ROUTER =====
	// UserRouter - Router quản lý người dùng cho admin
	// Chức năng: kích hoạt tài khoản, vô hiệu hóa, phân quyền role
	// Endpoints: GET/POST/PUT/DELETE /admin/users/*
	UserRouter
	
	// ===== ADMIN AUTHENTICATION ROUTER =====
	// AdminRouter - Router xác thực và quản lý admin
	// Chức năng: đăng nhập admin, quản lý session, admin operations
	// Endpoints: POST /admin/login, /admin/logout, /admin/profile
	AdminRouter
	
	// ===== PRODUCT MANAGEMENT ROUTER =====
	// ProductManageRouter - Router quản lý sản phẩm cho admin
	// Chức năng: CRUD sản phẩm, phê duyệt, quản lý giá, categories
	// Endpoints: GET/POST/PUT/DELETE /admin/products/*
	ProductManageRouter
	
	// ===== INVENTORY MANAGEMENT ROUTER =====
	// InventoryManageRouter - Router quản lý kho hàng cho admin
	// Chức năng: nhập/xuất kho, quản lý tồn kho, báo cáo analytics
	// Endpoints: GET/POST/PUT /admin/inventory/*
	InventoryManageRouter
	
	// ===== SALES MANAGEMENT ROUTER =====
	// SalesManageRouter - Router quản lý bán hàng cho admin
	// Chức năng: tạo phiếu bán hàng, xử lý giao dịch, báo cáo doanh thu
	// Endpoints: GET/POST/PUT/DELETE /admin/sales/*
	SalesManageRouter
}
