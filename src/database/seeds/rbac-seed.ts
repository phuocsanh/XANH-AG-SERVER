import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '../../entities/role.entity';
import { Permission } from '../../entities/permission.entity';
import { User } from '../../entities/users.entity';
import { UserProfile } from '../../entities/user-profiles.entity';
import { BaseStatus } from '../../entities/base-status.enum';
import { PERMISSIONS } from './permissions.config';
import { getRolesData } from './roles.config';

/**
 * Seed dữ liệu RBAC: Roles, Permissions, và Super Admin
 */
export async function seedRBAC(dataSource: DataSource) {
  const roleRepository = dataSource.getRepository(Role);
  const permissionRepository = dataSource.getRepository(Permission);
  const userRepository = dataSource.getRepository(User);
  const userProfileRepository = dataSource.getRepository(UserProfile);

  console.log('🌱 Bắt đầu seed RBAC...');

  // 1. Tạo Permissions từ config
  const createdPermissions: Permission[] = [];
  for (const permData of PERMISSIONS) {
    let permission = await permissionRepository.findOne({ where: { code: permData.code } });
    if (!permission) {
      permission = permissionRepository.create(permData);
      permission = await permissionRepository.save(permission);
      console.log(`✅ Tạo permission: ${permData.code}`);
    }
    createdPermissions.push(permission);
  }


  // 2. Tạo Roles từ config
  const rolesData = getRolesData(createdPermissions.map(p => p.code));


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
  const superAdminPassword = process.env.ADMIN_DEFAULT_PASSWORD || '123456'; // Mật khẩu mặc định (nên đổi qua .env)

  let superAdmin = await userRepository.findOne({ 
    where: { account: superAdminAccount },
  });

  if (!superAdmin && createdRoles['SUPER_ADMIN']) {
    const superAdminRole = createdRoles['SUPER_ADMIN'];
    console.log(`🔍 Super Admin Role:`, {
      id: superAdminRole.id,
      code: superAdminRole.code,
      name: superAdminRole.name,
    });

    // Verify role tồn tại trong database
    const roleInDb = await roleRepository.findOne({ where: { id: superAdminRole.id } });
    console.log(`🔍 Role in database:`, roleInDb ? { id: roleInDb.id, code: roleInDb.code } : 'NOT FOUND!');

    if (!roleInDb) {
      throw new Error(`Role với id=${superAdminRole.id} không tồn tại trong database!`);
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(superAdminPassword, salt);

    superAdmin = userRepository.create({
      account: superAdminAccount,
      password: hashedPassword,
      salt: salt,
      status: BaseStatus.ACTIVE,
      role_id: superAdminRole.id, // Sử dụng role_id trực tiếp
      role: superAdminRole, // Cũng set relation để TypeORM biết
    });

    console.log(`🔍 User before save:`, {
      account: superAdmin.account,
      role_id: superAdmin.role_id,
      role: superAdmin.role ? { id: superAdmin.role.id, code: superAdmin.role.code } : null,
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
