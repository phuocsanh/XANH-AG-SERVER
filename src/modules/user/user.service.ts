import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, Not, IsNull } from 'typeorm';
import { User } from '../../entities/users.entity';
import { UserProfile } from '../../entities/user-profiles.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SearchUserDto } from './dto/search-user.dto';
import { FilterConditionDto } from './dto/filter-condition.dto';
import * as bcrypt from 'bcrypt';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { BaseStatus } from '../../entities/base-status.enum';

/**
 * Service xử lý logic nghiệp vụ liên quan đến người dùng
 * Bao gồm các thao tác CRUD, xác thực và quản lý mật khẩu cho User
 */
@Injectable()
export class UserService {
  /**
   * Constructor injection các repository cần thiết
   * @param userRepository - Repository để thao tác với entity User
   * @param userProfileRepository - Repository để thao tác với entity UserProfile
   */
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private userProfileRepository: Repository<UserProfile>,
  ) {}

  /**
   * Tạo người dùng mới
   * @param createUserDto - Dữ liệu tạo người dùng mới
   * @returns Thông tin người dùng đã tạo
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      // Kiểm tra xem account đã tồn tại chưa
      const existingUser = await this.findByAccount(createUserDto.account);
      if (existingUser) {
        throw new Error('Account already exists');
      }

      // Tạo salt và hash password
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(createUserDto.password, salt);

      // Tìm role USER mặc định
      const userRole = await this.userRepository.manager.getRepository('Role').findOne({
        where: { code: 'USER' }
      });

      // Tạo user entity với status PENDING và role USER
      const user = this.userRepository.create({
        account: createUserDto.account,
        password: hashedPassword,
        salt: salt,
        status: BaseStatus.PENDING, // Chờ duyệt
        role_id: userRole?.id,
      });

      // Lưu user
      const savedUser = await this.userRepository.save(user);

      // Tạo user profile mặc định
      const userProfile = this.userProfileRepository.create({
        user_id: savedUser.id,
        account: savedUser.account,
      });
      await this.userProfileRepository.save(userProfile);

      return savedUser;
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'người dùng');
    }
  }

  /**
   * Lấy danh sách tất cả người dùng
   * @returns Danh sách người dùng
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  /**
   * Tìm người dùng theo ID
   * @param id - ID của người dùng cần tìm
   * @returns Thông tin người dùng
   */
  async findOne(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Tìm người dùng theo tên tài khoản
   * @param account - Tên tài khoản cần tìm
   * @returns Thông tin người dùng
   */
  async findByAccount(account: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: {
        account,
        deleted_at: IsNull(),
      },
      order: {
        id: 'DESC', // Get the latest user with this account
      },
    });
  }

  /**
   * Tìm người dùng theo ID kèm theo role và permissions
   * Dùng cho JWT strategy để load đầy đủ thông tin phân quyền
   * @param id - ID của người dùng cần tìm
   * @returns Thông tin người dùng với role và permissions
   */
  async findOneWithPermissions(id: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['role', 'role.permissions'],
    });
  }

  /**
   * Cập nhật thông tin người dùng
   * @param id - ID của người dùng cần cập nhật
   * @param updateUserDto - Dữ liệu cập nhật người dùng
   * @returns Thông tin người dùng đã cập nhật
   */
  async update(id: number, updateUserDto: UpdateUserDto): Promise<User | null> {
    try {
      // Tách các trường thuộc UserProfile
      const userProfileFields = ['email'];
      const userProfileData: any = {};
      const userData: any = {};

      // Phân loại các trường vào đúng entity
      for (const [key, value] of Object.entries(updateUserDto)) {
        if (userProfileFields.includes(key)) {
          userProfileData[key] = value;
        } else {
          userData[key] = value;
        }
      }

      // Cập nhật thông tin User nếu có dữ liệu
      if (Object.keys(userData).length > 0) {
        await this.userRepository.update(id, userData);
      }

      // Cập nhật thông tin UserProfile nếu có dữ liệu
      if (Object.keys(userProfileData).length > 0) {
        await this.userProfileRepository.update(
          { user_id: id },
          userProfileData,
        );
      }

      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'người dùng');
    }
  }

  /**
   * Thay đổi mật khẩu người dùng
   * @param id - ID của người dùng cần thay đổi mật khẩu
   * @param changePasswordDto - Dữ liệu thay đổi mật khẩu
   * @returns true nếu thay đổi thành công, false nếu thất bại
   */
  async changePassword(
    userId: number,
    changePasswordDto: ChangePasswordDto,
  ): Promise<boolean> {
    // Tìm người dùng theo ID
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return false;
    }

    // Kiểm tra mật khẩu cũ
    const isOldPasswordValid = await bcrypt.compare(
      changePasswordDto.old_password,
      user.password,
    );
    if (!isOldPasswordValid) {
      return false;
    }

    // Mã hóa mật khẩu mới
    const hashedNewPassword = await bcrypt.hash(
      changePasswordDto.new_password,
      10,
    );

    // Cập nhật mật khẩu
    await this.userRepository.update(userId, {
      password: hashedNewPassword,
    });

    return true;
  }

  /**
   * Cập nhật thông tin profile người dùng
   * @param id - ID của người dùng cần cập nhật profile
   * @param profileData - Dữ liệu cập nhật profile
   * @returns Thông tin profile đã cập nhật
   */
  async updateUserProfile(
    userId: number,
    profileData: Partial<UserProfile>,
  ): Promise<UserProfile | null> {
    await this.userProfileRepository.update({ user_id: userId }, profileData);
    return this.userProfileRepository.findOne({ where: { user_id: userId } });
  }

  /**
   * Kích hoạt người dùng
   * @param userId - ID của người dùng cần kích hoạt
   * @param operatorRoleCode - Role code của người thực hiện (SUPER_ADMIN hoặc ADMIN)
   * @returns Thông tin người dùng đã kích hoạt
   */
  async activate(userId: number, operatorRoleCode: string): Promise<User | null> {
    // Lấy thông tin user cần kích hoạt
    const targetUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!targetUser) {
      throw new Error('User not found');
    }

    const targetRoleCode = (targetUser.role as any)?.code;

    // Kiểm tra quyền: ADMIN không được kích hoạt SUPER_ADMIN hoặc ADMIN khác
    if (operatorRoleCode === 'ADMIN' && ['SUPER_ADMIN', 'ADMIN'].includes(targetRoleCode)) {
      throw new Error('Admin cannot activate Super Admin or other Admin accounts');
    }

    await this.userRepository.update(userId, { status: BaseStatus.ACTIVE });
    return this.findOne(userId);
  }

  /**
   * Vô hiệu hóa người dùng
   * @param userId - ID của người dùng cần vô hiệu hóa
   * @param operatorRoleCode - Role code của người thực hiện (SUPER_ADMIN hoặc ADMIN)
   * @returns Thông tin người dùng đã vô hiệu hóa
   */
  async deactivate(userId: number, operatorRoleCode: string): Promise<User | null> {
    // Lấy thông tin user cần vô hiệu hóa
    const targetUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!targetUser) {
      throw new Error('User not found');
    }

    const targetRoleCode = (targetUser.role as any)?.code;

    // Kiểm tra quyền: ADMIN không được vô hiệu hóa SUPER_ADMIN hoặc ADMIN khác
    if (operatorRoleCode === 'ADMIN' && ['SUPER_ADMIN', 'ADMIN'].includes(targetRoleCode)) {
      throw new Error('Admin cannot deactivate Super Admin or other Admin accounts');
    }

    await this.userRepository.update(userId, { status: BaseStatus.INACTIVE });
    return this.findOne(userId);
  }

  /**
   * Lưu trữ người dùng
   * @param id - ID của người dùng cần lưu trữ
   * @returns Thông tin người dùng đã lưu trữ
   */
  async archive(userId: number): Promise<User | null> {
    await this.userRepository.update(userId, { status: BaseStatus.ARCHIVED });
    return this.findOne(userId);
  }

  /**
   * Lấy danh sách người dùng theo trạng thái
   * @param status - Trạng thái cần lọc
   * @returns Danh sách người dùng theo trạng thái
   */
  async findByStatus(status: BaseStatus): Promise<User[]> {
    return this.userRepository.find({
      where: { status },
    });
  }

  /**
   * Lấy danh sách người dùng đã xóa mềm
   * @returns Danh sách người dùng đã xóa mềm
   */
  async findDeleted(): Promise<User[]> {
    return this.userRepository.find({
      where: { deleted_at: Not(IsNull()) },
      withDeleted: true,
    });
  }

  /**
   * Xóa mềm người dùng (soft delete)
   * @param id - ID của người dùng cần xóa mềm
   * @returns Thông tin người dùng đã được xóa mềm
   */
  async softRemove(userId: number): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return null;
    }

    await this.userRepository.softDelete(userId);
    return this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });
  }

  /**
   * Khôi phục người dùng đã bị xóa mềm
   * @param id - ID của người dùng cần khôi phục
   * @returns Thông tin người dùng đã khôi phục
   */
  async restore(userId: number): Promise<User | null> {
    await this.userRepository.restore(userId);
    return this.userRepository.findOne({ where: { id: userId } });
  }

  /**
   * Tạo tài khoản bởi Admin/Super Admin
   * @param createUserByAdminDto - Dữ liệu tạo người dùng bởi admin
   * @param creatorRoleCode - Role code của người tạo (SUPER_ADMIN hoặc ADMIN)
   * @returns Thông tin người dùng đã tạo
   */
  async createByAdmin(
    createUserByAdminDto: any,
    creatorRoleCode: string,
  ): Promise<User> {
    try {
      // Kiểm tra xem account đã tồn tại chưa
      const existingUser = await this.findByAccount(createUserByAdminDto.account);
      if (existingUser) {
        throw new Error('Account already exists');
      }

      // Lấy thông tin role được gán
      const targetRole = await this.userRepository.manager.getRepository('Role').findOne({
        where: { id: createUserByAdminDto.role_id },
        select: ['id', 'code', 'name'],
      });

      if (!targetRole) {
        throw new Error('Role not found');
      }

      // Kiểm tra quyền tạo role
      // SUPER_ADMIN có thể tạo tất cả (ADMIN, STAFF, USER)
      // ADMIN chỉ có thể tạo STAFF và USER
      if (creatorRoleCode === 'ADMIN' && targetRole.code === 'ADMIN') {
        throw new Error('Admin cannot create another Admin account');
      }

      if (creatorRoleCode === 'ADMIN' && targetRole.code === 'SUPER_ADMIN') {
        throw new Error('Admin cannot create Super Admin account');
      }

      // Tạo salt và hash password
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(createUserByAdminDto.password, salt);

      // Tạo user entity với status PENDING
      const user = this.userRepository.create({
        account: createUserByAdminDto.account,
        password: hashedPassword,
        salt: salt,
        status: BaseStatus.PENDING, // Admin tạo cũng cần duyệt
        role_id: createUserByAdminDto.role_id,
      });

      // Lưu user
      const savedUser = await this.userRepository.save(user);

      // Tạo user profile
      const userProfile = this.userProfileRepository.create({
        user_id: savedUser.id,
        account: savedUser.account,
        nickname: createUserByAdminDto.nickname,
        email: createUserByAdminDto.email,
        mobile: createUserByAdminDto.mobile,
      });
      await this.userProfileRepository.save(userProfile);

      return savedUser;
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'người dùng');
    }
  }

  /**
   * Duyệt tài khoản người dùng
   * @param userId - ID của người dùng cần duyệt
   * @param approverRoleCode - Role code của người duyệt
   * @returns Thông tin người dùng đã duyệt
   */
  async approveUser(userId: number, approverRoleCode: string): Promise<User | null> {
    try {
      // Lấy thông tin user cần duyệt
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role'],
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.status !== BaseStatus.PENDING) {
        throw new Error('User is not in pending status');
      }

      // Kiểm tra quyền duyệt
      const userRoleCode = (user.role as any)?.code;

      // SUPER_ADMIN có thể duyệt tất cả
      // ADMIN chỉ có thể duyệt USER và STAFF
      if (approverRoleCode === 'ADMIN' && userRoleCode === 'ADMIN') {
        throw new Error('Admin cannot approve another Admin account');
      }

      // Chuyển status sang ACTIVE
      await this.userRepository.update(userId, { status: BaseStatus.ACTIVE });

      return this.findOne(userId);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'duyệt người dùng');
    }
  }

  /**
   * Lấy danh sách người dùng chờ duyệt
   * @returns Danh sách người dùng có status PENDING
   */
  async getPendingUsers(): Promise<User[]> {
    return this.userRepository.find({
      where: { status: BaseStatus.PENDING },
      relations: ['role'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Xóa tất cả người dùng (chỉ dùng cho mục đích debug)
   */
  async clearAllUsers(): Promise<void> {
    await this.userRepository.clear();
  }

  /**
   * Xóa người dùng theo ID (soft delete)
   * @param userId - ID của người dùng cần xóa
   * @param operatorRoleCode - Role code của người thực hiện (SUPER_ADMIN hoặc ADMIN)
   */
  async remove(userId: number, operatorRoleCode: string): Promise<void> {
    // Lấy thông tin user cần xóa
    const targetUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!targetUser) {
      throw new Error('User not found');
    }

    const targetRoleCode = (targetUser.role as any)?.code;

    // Kiểm tra quyền: ADMIN không được xóa SUPER_ADMIN hoặc ADMIN khác
    if (operatorRoleCode === 'ADMIN' && ['SUPER_ADMIN', 'ADMIN'].includes(targetRoleCode)) {
      throw new Error('Admin cannot delete Super Admin or other Admin accounts');
    }

    await this.userRepository.softDelete(userId);
  }

  /**
   * Tìm kiếm nâng cao người dùng với cấu trúc filter lồng nhau
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách người dùng phù hợp với thông tin phân trang
   */
  async searchUsers(searchDto: SearchUserDto): Promise<{
    data: User[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Thêm điều kiện mặc định
    queryBuilder.where('user.deleted_at IS NULL');

    // Xây dựng điều kiện tìm kiếm
    this.buildSearchConditions(queryBuilder, searchDto, 'user');

    // Xử lý phân trang
    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);

    // Thực hiện truy vấn
    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Xây dựng các điều kiện tìm kiếm động
   * @param queryBuilder - Query builder
   * @param searchDto - DTO tìm kiếm
   * @param alias - Alias của bảng
   * @param parameterIndex - Chỉ số để tạo parameter name duy nhất
   */
  private buildSearchConditions(
    queryBuilder: SelectQueryBuilder<User>,
    searchDto: SearchUserDto,
    alias: string,
    parameterIndex: number = 0,
  ): number {
    // Xử lý các điều kiện lọc cơ bản
    if (searchDto.filters && searchDto.filters.length > 0) {
      const operator = searchDto.operator || 'AND';
      const conditions: string[] = [];
      const parameters: { [key: string]: any } = {};

      searchDto.filters.forEach((filter, index) => {
        const condition = this.buildFilterCondition(
          filter,
          alias,
          parameterIndex + index,
          parameters,
        );
        if (condition) {
          conditions.push(condition);
        }
      });

      if (conditions.length > 0) {
        const combinedCondition = conditions.join(` ${operator} `);
        queryBuilder.andWhere(`(${combinedCondition})`, parameters);
      }

      parameterIndex += searchDto.filters.length;
    }

    // Xử lý các bộ lọc lồng nhau
    if (searchDto.nested_filters && searchDto.nested_filters.length > 0) {
      // Xây dựng điều kiện cho từng bộ lọc lồng nhau
      searchDto.nested_filters.forEach((nestedFilter) => {
        parameterIndex = this.buildSearchConditions(
          queryBuilder,
          nestedFilter,
          alias,
          parameterIndex,
        );
      });
    }

    return parameterIndex;
  }

  /**
   * Xây dựng điều kiện lọc đơn lẻ
   * @param filter - Điều kiện lọc
   * @param alias - Alias của bảng
   * @param index - Chỉ số để tạo parameter name duy nhất
   * @param parameters - Object chứa các parameter
   * @returns Chuỗi điều kiện SQL
   */
  private buildFilterCondition(
    filter: FilterConditionDto,
    alias: string,
    index: number,
    parameters: { [key: string]: any },
  ): string | null {
    if (!filter.field || !filter.operator) {
      return null;
    }

    const paramName = `param_${index}`;
    const field = `${alias}.${filter.field}`;

    switch (filter.operator) {
      case 'eq':
        parameters[paramName] = filter.value;
        return `${field} = :${paramName}`;
      case 'ne':
        parameters[paramName] = filter.value;
        return `${field} != :${paramName}`;
      case 'gt':
        parameters[paramName] = filter.value;
        return `${field} > :${paramName}`;
      case 'gte':
        parameters[paramName] = filter.value;
        return `${field} >= :${paramName}`;
      case 'lt':
        parameters[paramName] = filter.value;
        return `${field} < :${paramName}`;
      case 'lte':
        parameters[paramName] = filter.value;
        return `${field} <= :${paramName}`;
      case 'like':
        parameters[paramName] = `%${filter.value}%`;
        return `${field} ILIKE :${paramName}`;
      case 'in':
        if (Array.isArray(filter.value)) {
          parameters[paramName] = filter.value;
          return `${field} IN (:...${paramName})`;
        }
        return null;
      case 'isnull':
        return `${field} IS NULL`;
      case 'isnotnull':
        return `${field} IS NOT NULL`;
      default:
        return null;
    }
  }
}
