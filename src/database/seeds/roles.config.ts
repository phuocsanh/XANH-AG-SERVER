/**
 * 🎭 ROLES CONFIGURATION
 * 
 * Định nghĩa Permission Groups và Roles
 */

/**
 * 📦 PERMISSION GROUPS
 * Nhóm permissions theo module để dễ quản lý và tái sử dụng
 */
export const PERMISSION_GROUPS = {
  // User Management
  USER: ['user:read', 'user:create', 'user:update', 'user:delete', 'user:approve'],
  USER_READ_ONLY: ['user:read'],
  
  // Role Management
  ROLE: ['role:manage'],
  
  // AI Features
  AI: ['ai:rice_blast:read', 'ai:rice_blast:manage'],
  AI_READ_ONLY: ['ai:rice_blast:read'],
  
  // Product Management
  PRODUCT: ['product:read', 'product:manage'],
  PRODUCT_READ_ONLY: ['product:read'],
  
  // Sales Management
  SALES: ['sales:read', 'sales:create', 'sales:manage'],
  SALES_READ_CREATE: ['sales:read', 'sales:create'],
  SALES_READ_ONLY: ['sales:read'],
  
  // Customer Management
  CUSTOMER: ['customer:read', 'customer:manage'],
  CUSTOMER_READ_ONLY: ['customer:read'],
  
  // Inventory Management
  INVENTORY: ['inventory:read', 'inventory:manage'],
  INVENTORY_READ_ONLY: ['inventory:read'],
  
  // Report
  REPORT: ['report:read', 'report:export'],
  REPORT_READ_ONLY: ['report:read'],
  
  // Rice Crop Management (Full CRUD)
  RICE_CROP: ['rice_crop:read', 'rice_crop:create', 'rice_crop:update', 'rice_crop:delete'],
  RICE_CROP_NO_DELETE: ['rice_crop:read', 'rice_crop:create', 'rice_crop:update'],
  
  // Cost Item (Full CRUD)
  COST_ITEM: ['cost_item:read', 'cost_item:create', 'cost_item:update', 'cost_item:delete'],
  COST_ITEM_NO_DELETE: ['cost_item:read', 'cost_item:create', 'cost_item:update'],
  
  // Harvest (Full CRUD)
  HARVEST: ['harvest:read', 'harvest:create', 'harvest:update', 'harvest:delete'],
  HARVEST_NO_DELETE: ['harvest:read', 'harvest:create', 'harvest:update'],
  
  // Schedule (Full CRUD)
  SCHEDULE: ['schedule:read', 'schedule:create', 'schedule:update', 'schedule:delete'],
  SCHEDULE_NO_DELETE: ['schedule:read', 'schedule:create', 'schedule:update'],
  
  // Application (Full CRUD)
  APPLICATION: ['application:read', 'application:create', 'application:update', 'application:delete'],
  APPLICATION_NO_DELETE: ['application:read', 'application:create', 'application:update'],
  
  // Growth (Full CRUD)
  GROWTH: ['growth:read', 'growth:create', 'growth:update', 'growth:delete'],
  GROWTH_NO_DELETE: ['growth:read', 'growth:create', 'growth:update'],
  
  // Area of Plot (Full CRUD)
  AREA: ['area_of_each_plot_of_land:read', 'area_of_each_plot_of_land:create', 'area_of_each_plot_of_land:update', 'area_of_each_plot_of_land:delete'],
  AREA_NO_DELETE: ['area_of_each_plot_of_land:read', 'area_of_each_plot_of_land:create', 'area_of_each_plot_of_land:update'],
  
  // Store Profit Report
  STORE_PROFIT: ['store_profit_report:read'],
  
  // Operating Cost
  OPERATING_COST: ['operating_cost:read', 'operating_cost:manage'],
  OPERATING_COST_READ_ONLY: ['operating_cost:read'],
};

/**
 * 🎭 ROLES DATA
 * Định nghĩa các vai trò và permissions tương ứng
 * 
 * @param allPermissionCodes - Tất cả permission codes (dùng cho SUPER_ADMIN)
 */
export const getRolesData = (allPermissionCodes: string[]) => [
  {
    code: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Chủ hệ thống - Toàn quyền',
    permissionCodes: allPermissionCodes, // Tất cả quyền
  },
  {
    code: 'ADMIN',
    name: 'Admin',
    description: 'Quản trị viên - Quản lý người dùng và hệ thống',
    permissionCodes: [
      ...PERMISSION_GROUPS.USER,
      ...PERMISSION_GROUPS.ROLE,
      ...PERMISSION_GROUPS.AI,
      ...PERMISSION_GROUPS.PRODUCT,
      ...PERMISSION_GROUPS.SALES,
      ...PERMISSION_GROUPS.CUSTOMER,
      ...PERMISSION_GROUPS.INVENTORY,
      ...PERMISSION_GROUPS.REPORT,
      ...PERMISSION_GROUPS.RICE_CROP,
      ...PERMISSION_GROUPS.COST_ITEM,
      ...PERMISSION_GROUPS.HARVEST,
      ...PERMISSION_GROUPS.SCHEDULE,
      ...PERMISSION_GROUPS.APPLICATION,
      ...PERMISSION_GROUPS.GROWTH,
      ...PERMISSION_GROUPS.AREA,
      ...PERMISSION_GROUPS.STORE_PROFIT,
      ...PERMISSION_GROUPS.OPERATING_COST,
    ],
  },
  {
    code: 'STAFF',
    name: 'Staff',
    description: 'Nhân viên - Xem và thao tác cơ bản',
    permissionCodes: [
      ...PERMISSION_GROUPS.USER_READ_ONLY,
      ...PERMISSION_GROUPS.AI_READ_ONLY,
      ...PERMISSION_GROUPS.PRODUCT_READ_ONLY,
      ...PERMISSION_GROUPS.SALES_READ_CREATE,
      ...PERMISSION_GROUPS.INVENTORY_READ_ONLY,
      ...PERMISSION_GROUPS.REPORT_READ_ONLY,
      ...PERMISSION_GROUPS.RICE_CROP_NO_DELETE,
      ...PERMISSION_GROUPS.COST_ITEM_NO_DELETE,
      ...PERMISSION_GROUPS.HARVEST_NO_DELETE,
      ...PERMISSION_GROUPS.SCHEDULE_NO_DELETE,
      ...PERMISSION_GROUPS.APPLICATION_NO_DELETE,
      ...PERMISSION_GROUPS.GROWTH_NO_DELETE,
      ...PERMISSION_GROUPS.AREA_NO_DELETE,
      ...PERMISSION_GROUPS.STORE_PROFIT,
      ...PERMISSION_GROUPS.OPERATING_COST_READ_ONLY,
    ],
  },
  {
    code: 'USER',
    name: 'User',
    description: 'Người dùng - Nông dân/Khách hàng',
    permissionCodes: [
      ...PERMISSION_GROUPS.AI_READ_ONLY,
      ...PERMISSION_GROUPS.PRODUCT_READ_ONLY,
      ...PERMISSION_GROUPS.SALES_READ_ONLY,
      ...PERMISSION_GROUPS.RICE_CROP_NO_DELETE,
      ...PERMISSION_GROUPS.COST_ITEM,
      ...PERMISSION_GROUPS.HARVEST,
      ...PERMISSION_GROUPS.SCHEDULE,
      ...PERMISSION_GROUPS.APPLICATION,
      ...PERMISSION_GROUPS.GROWTH,
      ...PERMISSION_GROUPS.AREA,
      ...PERMISSION_GROUPS.STORE_PROFIT,
    ],
  },
];
