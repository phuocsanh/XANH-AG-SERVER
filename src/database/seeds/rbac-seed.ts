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
