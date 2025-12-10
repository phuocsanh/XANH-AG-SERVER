import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '../../entities/role.entity';
import { Permission } from '../../entities/permission.entity';
import { User } from '../../entities/users.entity';
import { UserProfile } from '../../entities/user-profiles.entity';
import { BaseStatus } from '../../entities/base-status.enum';

/**
 * Seed dữ liệu RBAC: Roles, Permissions, và Super Admin
 */
export async function seedRBAC(dataSource: DataSource) {
  const roleRepository = dataSource.getRepository(Role);
  const permissionRepository = dataSource.getRepository(Permission);
  const userRepository = dataSource.getRepository(User);
  const userProfileRepository = dataSource.getRepository(UserProfile);

  console.log('🌱 Bắt đầu seed RBAC...');

  // 1. Tạo Permissions
  const permissions = [
    // User Management
    { code: 'USER_VIEW', name: 'Xem người dùng', group: 'User Management', description: 'Xem danh sách và thông tin người dùng' },
    { code: 'USER_CREATE', name: 'Tạo người dùng', group: 'User Management', description: 'Tạo tài khoản người dùng mới' },
    { code: 'USER_UPDATE', name: 'Cập nhật người dùng', group: 'User Management', description: 'Chỉnh sửa thông tin người dùng' },
    { code: 'USER_DELETE', name: 'Xóa người dùng', group: 'User Management', description: 'Xóa tài khoản người dùng' },
    { code: 'USER_APPROVE', name: 'Duyệt người dùng', group: 'User Management', description: 'Duyệt tài khoản đăng ký mới' },
    
    // Role & Permission Management
    { code: 'ROLE_MANAGE', name: 'Quản lý vai trò', group: 'Role Management', description: 'Quản lý roles và permissions' },
    
    // Rice Blast
    { code: 'RICE_BLAST_VIEW', name: 'Xem cảnh báo đạo ôn', group: 'Rice Blast', description: 'Xem cảnh báo bệnh đạo ôn' },
    { code: 'RICE_BLAST_MANAGE', name: 'Quản lý cảnh báo đạo ôn', group: 'Rice Blast', description: 'Cập nhật vị trí và chạy phân tích' },
    
    // Product Management
    { code: 'PRODUCT_VIEW', name: 'Xem sản phẩm', group: 'Product Management', description: 'Xem danh sách sản phẩm' },
    { code: 'PRODUCT_MANAGE', name: 'Quản lý sản phẩm', group: 'Product Management', description: 'Tạo, sửa, xóa sản phẩm' },
    
    // Sales Management
    { code: 'SALES_VIEW', name: 'Xem hóa đơn', group: 'Sales Management', description: 'Xem hóa đơn bán hàng' },
    { code: 'SALES_CREATE', name: 'Tạo hóa đơn', group: 'Sales Management', description: 'Tạo hóa đơn bán hàng mới' },
    { code: 'SALES_MANAGE', name: 'Quản lý hóa đơn', group: 'Sales Management', description: 'Sửa, xóa hóa đơn' },
    
    // Inventory Management
    { code: 'INVENTORY_VIEW', name: 'Xem kho', group: 'Inventory Management', description: 'Xem tồn kho' },
    { code: 'INVENTORY_MANAGE', name: 'Quản lý kho', group: 'Inventory Management', description: 'Nhập xuất kho' },
    
    // Report
    { code: 'REPORT_VIEW', name: 'Xem báo cáo', group: 'Report', description: 'Xem các báo cáo thống kê' },
    { code: 'REPORT_EXPORT', name: 'Xuất báo cáo', group: 'Report', description: 'Xuất báo cáo ra file' },
    
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
    { code: 'store-profit-report:read', name: 'Xem báo cáo lợi nhuận', group: 'Store Profit Report', description: 'Xem báo cáo lợi nhuận cửa hàng' },
    
    // Operating Cost Management
    { code: 'OPERATING_COST_VIEW', name: 'Xem chi phí vận hành', group: 'Operating Cost', description: 'Xem danh sách chi phí vận hành' },
    { code: 'OPERATING_COST_MANAGE', name: 'Quản lý chi phí vận hành', group: 'Operating Cost', description: 'Thêm sửa xóa chi phí vận hành' },
  ];

  const createdPermissions: Permission[] = [];
  for (const permData of permissions) {
    let permission = await permissionRepository.findOne({ where: { code: permData.code } });
    if (!permission) {
      permission = permissionRepository.create(permData);
      permission = await permissionRepository.save(permission);
      console.log(`✅ Tạo permission: ${permData.code}`);
    }
    createdPermissions.push(permission);
  }

  // 2. Tạo Roles với Permissions tương ứng
  const rolesData = [
    {
      code: 'SUPER_ADMIN',
      name: 'Super Admin',
      description: 'Chủ hệ thống - Toàn quyền',
      permissionCodes: createdPermissions.map(p => p.code), // Tất cả quyền
    },
    {
      code: 'ADMIN',
      name: 'Admin',
      description: 'Quản trị viên - Quản lý người dùng và hệ thống',
      permissionCodes: [
        'USER_VIEW', 'USER_CREATE', 'USER_UPDATE', 'USER_APPROVE',
        'RICE_BLAST_VIEW', 'RICE_BLAST_MANAGE',
        'PRODUCT_VIEW', 'PRODUCT_MANAGE',
        'SALES_VIEW', 'SALES_CREATE', 'SALES_MANAGE',
        'INVENTORY_VIEW', 'INVENTORY_MANAGE',
        'REPORT_VIEW', 'REPORT_EXPORT',
        'rice_crop:read', 'rice_crop:create', 'rice_crop:update', 'rice_crop:delete',
        'cost_item:read', 'cost_item:create', 'cost_item:update', 'cost_item:delete',
        'harvest:read', 'harvest:create', 'harvest:update', 'harvest:delete',
        'schedule:read', 'schedule:create', 'schedule:update', 'schedule:delete',
        'application:read', 'application:create', 'application:update', 'application:delete',
        'growth:read', 'growth:create', 'growth:update', 'growth:delete',
        'area_of_each_plot_of_land:read', 'area_of_each_plot_of_land:create', 'area_of_each_plot_of_land:update', 'area_of_each_plot_of_land:delete',
        'store-profit-report:read',
        'OPERATING_COST_VIEW', 'OPERATING_COST_MANAGE',
      ],
    },
    {
      code: 'STAFF',
      name: 'Staff',
      description: 'Nhân viên - Xem và thao tác cơ bản',
      permissionCodes: [
        'USER_VIEW',
        'RICE_BLAST_VIEW',
        'PRODUCT_VIEW',
        'SALES_VIEW', 'SALES_CREATE',
        'INVENTORY_VIEW',
        'REPORT_VIEW',
        'rice_crop:read', 'rice_crop:create', 'rice_crop:update',
        'cost_item:read', 'cost_item:create', 'cost_item:update',
        'harvest:read', 'harvest:create', 'harvest:update',
        'schedule:read', 'schedule:create', 'schedule:update',
        'application:read', 'application:create', 'application:update',
        'growth:read', 'growth:create', 'growth:update',
        'area_of_each_plot_of_land:read', 'area_of_each_plot_of_land:create', 'area_of_each_plot_of_land:update',
        'store-profit-report:read',
        'OPERATING_COST_VIEW', 'OPERATING_COST_MANAGE',
      ],
    },
    {
      code: 'USER',
      name: 'User',
      description: 'Người dùng - Nông dân',
      permissionCodes: [
        'RICE_BLAST_VIEW',
        'PRODUCT_VIEW',
        'SALES_VIEW',
        'rice_crop:read', 'rice_crop:create', 'rice_crop:update',
        'cost_item:read', 'cost_item:create', 'cost_item:update',
        'harvest:read', 'harvest:create', 'harvest:update',
        'schedule:read', 'schedule:create', 'schedule:update',
        'application:read', 'application:create', 'application:update',
        'growth:read', 'growth:create', 'growth:update',
        'area_of_each_plot_of_land:read', 'area_of_each_plot_of_land:create', 'area_of_each_plot_of_land:update',
        'store-profit-report:read',
      ],
    },
  ];

  const createdRoles: { [key: string]: Role } = {};
  for (const roleData of rolesData) {
    let role = await roleRepository.findOne({ 
      where: { code: roleData.code },
      relations: ['permissions'],
    });
    
    if (!role) {
      role = roleRepository.create({
        code: roleData.code,
        name: roleData.name,
        description: roleData.description,
      });
    }

    // Gán permissions
    const rolePermissions = createdPermissions.filter(p => 
      roleData.permissionCodes.includes(p.code)
    );
    role.permissions = rolePermissions;
    
    role = await roleRepository.save(role);
    createdRoles[roleData.code] = role;
    console.log(`✅ Tạo role: ${roleData.code} với ${rolePermissions.length} quyền`);
  }

  // 3. Tạo tài khoản Super Admin mặc định
  const superAdminAccount = 'admin';
  const superAdminPassword = 'sanhtps'; // Mật khẩu theo yêu cầu

  let superAdmin = await userRepository.findOne({ 
    where: { account: superAdminAccount },
  });

  if (!superAdmin && createdRoles['SUPER_ADMIN']) {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(superAdminPassword, salt);

    superAdmin = userRepository.create({
      account: superAdminAccount,
      password: hashedPassword,
      salt: salt,
      status: BaseStatus.ACTIVE,
      role_id: createdRoles['SUPER_ADMIN'].id,
    });

    superAdmin = await userRepository.save(superAdmin);

    // Tạo profile cho Super Admin
    const superAdminProfile = userProfileRepository.create({
      user_id: superAdmin.id,
      account: superAdminAccount,
      nickname: 'Administrator',
      is_authentication: 1,
    });
    await userProfileRepository.save(superAdminProfile);

    console.log(`✅ Tạo tài khoản Super Admin:`);
    console.log(`   Account: ${superAdminAccount}`);
    console.log(`   Password: ${superAdminPassword}`);
  } else {
    console.log(`ℹ️  Tài khoản ${superAdminAccount} đã tồn tại`);
  }

  console.log('✅ Hoàn tất seed RBAC!');
}
