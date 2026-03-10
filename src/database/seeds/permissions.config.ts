/**
 * 📋 PERMISSIONS CONFIGURATION
 * 
 * Định nghĩa TẤT CẢ permissions trong hệ thống
 * Format: resource:action (VD: user:read, product:manage)
 */

export const PERMISSIONS = [
  // User Management
  { code: 'user:read', name: 'Xem người dùng', group: 'User Management', description: 'Xem danh sách và thông tin người dùng' },
  { code: 'user:create', name: 'Tạo người dùng', group: 'User Management', description: 'Tạo tài khoản người dùng mới' },
  { code: 'user:update', name: 'Cập nhật người dùng', group: 'User Management', description: 'Chỉnh sửa thông tin người dùng' },
  { code: 'user:delete', name: 'Xóa người dùng', group: 'User Management', description: 'Xóa tài khoản người dùng' },
  { code: 'user:approve', name: 'Duyệt người dùng', group: 'User Management', description: 'Duyệt tài khoản đăng ký mới' },
  
  // Role & Permission Management
  { code: 'role:manage', name: 'Quản lý vai trò', group: 'Role Management', description: 'Quản lý roles và permissions' },
  
  // AI Features
  { code: 'ai:rice_blast:read', name: 'Xem cảnh báo đạo ôn', group: 'AI Features', description: 'Xem cảnh báo bệnh đạo ôn' },
  { code: 'ai:rice_blast:manage', name: 'Quản lý cảnh báo đạo ôn', group: 'AI Features', description: 'Cập nhật vị trí và chạy phân tích' },
  
  // Product Management
  { code: 'product:read', name: 'Xem sản phẩm', group: 'Product Management', description: 'Xem danh sách sản phẩm' },
  { code: 'product:manage', name: 'Quản lý sản phẩm', group: 'Product Management', description: 'Tạo, sửa, xóa sản phẩm' },
  
  // Season Management
  { code: 'season:read', name: 'Xem mùa vụ', group: 'Season Management', description: 'Xem danh sách mùa vụ' },
  { code: 'season:manage', name: 'Quản lý mùa vụ', group: 'Season Management', description: 'Tạo, sửa, xóa mùa vụ' },
  
  // Sales Management
  { code: 'sales:read', name: 'Xem hóa đơn', group: 'Sales Management', description: 'Xem hóa đơn bán hàng' },
  { code: 'sales:create', name: 'Tạo hóa đơn', group: 'Sales Management', description: 'Tạo hóa đơn bán hàng mới' },
  { code: 'sales:manage', name: 'Quản lý hóa đơn', group: 'Sales Management', description: 'Sửa, xóa hóa đơn' },
  
  // Customer Management
  { code: 'customer:read', name: 'Xem khách hàng', group: 'Customer Management', description: 'Xem danh sách khách hàng' },
  { code: 'customer:manage', name: 'Quản lý khách hàng', group: 'Customer Management', description: 'Tạo, sửa, xóa khách hàng và tạo tài khoản' },
  
  // Inventory Management
  { code: 'inventory:read', name: 'Xem kho', group: 'Inventory Management', description: 'Xem tồn kho' },
  { code: 'inventory:manage', name: 'Quản lý kho', group: 'Inventory Management', description: 'Nhập xuất kho' },
  
  // Report
  { code: 'report:read', name: 'Xem báo cáo', group: 'Report', description: 'Xem các báo cáo thống kê' },
  { code: 'report:export', name: 'Xuất báo cáo', group: 'Report', description: 'Xuất báo cáo ra file' },
  
  // Rice Crop Management
  { code: 'rice_crop:read', name: 'Xem vụ lúa', group: 'Rice Crop Management', description: 'Xem danh sách và chi tiết mảnh ruộng' },
  { code: 'rice_crop:create', name: 'Tạo mảnh ruộng', group: 'Rice Crop Management', description: 'Tạo mảnh ruộng mới' },
  { code: 'rice_crop:update', name: 'Cập nhật mảnh ruộng', group: 'Rice Crop Management', description: 'Cập nhật thông tin mảnh ruộng' },
  { code: 'rice_crop:delete', name: 'Xóa mảnh ruộng', group: 'Rice Crop Management', description: 'Xóa mảnh ruộng' },
  
  // Cost Item Management
  { code: 'cost_item:read', name: 'Xem chi phí', group: 'Cost Item Management', description: 'Xem danh sách chi phí' },
  { code: 'cost_item:create', name: 'Thêm chi phí', group: 'Cost Item Management', description: 'Thêm chi phí mới' },
  { code: 'cost_item:update', name: 'Cập nhật chi phí', group: 'Cost Item Management', description: 'Cập nhật chi phí' },
  { code: 'cost_item:delete', name: 'Xóa chi phí', group: 'Cost Item Management', description: 'Xóa chi phí' },
  { code: 'cost_item:manage', name: 'Quản lý chi phí', group: 'Cost Item Management', description: 'Toàn quyền quản lý chi phí' },
  
  // Harvest Record Management
  { code: 'harvest:read', name: 'Xem thu hoạch', group: 'Harvest Management', description: 'Xem thông tin thu hoạch' },
  { code: 'harvest:create', name: 'Ghi nhận thu hoạch', group: 'Harvest Management', description: 'Ghi nhận thu hoạch mới' },
  { code: 'harvest:update', name: 'Cập nhật thu hoạch', group: 'Harvest Management', description: 'Cập nhật thông tin thu hoạch' },
  { code: 'harvest:delete', name: 'Xóa thu hoạch', group: 'Harvest Management', description: 'Xóa thông tin thu hoạch' },
  
  // Farming Schedule Management
  { code: 'schedule:read', name: 'Xem lịch canh tác', group: 'Schedule Management', description: 'Xem lịch canh tác' },
  { code: 'schedule:create', name: 'Tạo lịch canh tác', group: 'Schedule Management', description: 'Tạo lịch canh tác mới' },
  { code: 'schedule:update', name: 'Cập nhật lịch', group: 'Schedule Management', description: 'Cập nhật lịch canh tác' },
  { code: 'schedule:delete', name: 'Xóa lịch', group: 'Schedule Management', description: 'Xóa lịch canh tác' },
  
  // Application Record Management
  { code: 'application:read', name: 'Xem nhật ký', group: 'Application Management', description: 'Xem nhật ký phun thuốc/bón phân' },
  { code: 'application:create', name: 'Ghi nhật ký', group: 'Application Management', description: 'Ghi nhật ký mới' },
  { code: 'application:update', name: 'Cập nhật nhật ký', group: 'Application Management', description: 'Cập nhật nhật ký' },
  { code: 'application:delete', name: 'Xóa nhật ký', group: 'Application Management', description: 'Xóa nhật ký' },
  
  // Growth Tracking Management
  { code: 'growth:read', name: 'Xem theo dõi', group: 'Growth Tracking', description: 'Xem theo dõi sinh trưởng' },
  { code: 'growth:create', name: 'Ghi nhận quan sát', group: 'Growth Tracking', description: 'Ghi nhận quan sát mới' },
  { code: 'growth:update', name: 'Cập nhật quan sát', group: 'Growth Tracking', description: 'Cập nhật quan sát' },
  { code: 'growth:delete', name: 'Xóa quan sát', group: 'Growth Tracking', description: 'Xóa quan sát' },
  
  // Area of Each Plot of Land Management
  { code: 'area_of_each_plot_of_land:read', name: 'Xem vùng/lô đất', group: 'Area Management', description: 'Xem danh sách vùng/lô đất' },
  { code: 'area_of_each_plot_of_land:create', name: 'Tạo vùng/lô đất', group: 'Area Management', description: 'Tạo vùng/lô đất mới' },
  { code: 'area_of_each_plot_of_land:update', name: 'Cập nhật vùng/lô đất', group: 'Area Management', description: 'Cập nhật thông tin vùng/lô đất' },
  { code: 'area_of_each_plot_of_land:delete', name: 'Xóa vùng/lô đất', group: 'Area Management', description: 'Xóa vùng/lô đất' },
  
  // Store Profit Report
  { code: 'store_profit_report:read', name: 'Xem báo cáo lợi nhuận', group: 'Store Profit Report', description: 'Xem báo cáo lợi nhuận cửa hàng' },
  
  // Operating Cost Management
  { code: 'operating_cost:read', name: 'Xem chi phí vận hành', group: 'Operating Cost', description: 'Xem danh sách chi phí vận hành' },
  { code: 'operating_cost:manage', name: 'Quản lý chi phí vận hành', group: 'Operating Cost', description: 'Thêm sửa xóa chi phí vận hành' },
  
  // News Management
  { code: 'news:manage', name: 'Quản lý tin tức', group: 'News Management', description: 'Tạo, sửa, xóa tin tức' },
];
