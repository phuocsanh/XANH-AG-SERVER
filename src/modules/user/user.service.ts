import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository,  Not, IsNull } from 'typeorm';
import { User } from '../../entities/users.entity';
import { UserProfile } from '../../entities/user-profiles.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SearchUserDto } from './dto/search-user.dto';
import * as bcrypt from 'bcrypt';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { BaseStatus } from '../../entities/base-status.enum';
import { ImageCleanupHelper } from '../../common/helpers/image-cleanup.helper';
import { UploadService } from '../upload/upload.service';
import { RoleCode } from '../../common/enums/role-code.enum';
import { QueryHelper } from '../../common/helpers/query-helper';

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
   * @param uploadService - Service quản lý upload và xóa file
   */
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private userProfileRepository: Repository<UserProfile>,
    @Inject(UploadService)
    private uploadService: UploadService,
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
        where: { code: RoleCode.USER }
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
    return this.userRepository.find({
      relations: ['profile'],
      select: {
        id: true,
        account: true,
        login_time: true,
        logout_time: true,
        login_ip: true,
        status: true,
        created_at: true,
        updated_at: true,
        is_two_factor_enabled: true,
        role_id: true,
        profile: {
          user_id: true,
          account: true,
          nickname: true,
          avatar: true,
          status: true,
          mobile: true,
          gender: true,
          birthday: true,
          email: true,
          is_authentication: true,
          created_at: true,
          updated_at: true,
        },
      },
    });
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
    // Lấy profile hiện tại để so sánh avatar
    const currentProfile = await this.userProfileRepository.findOne({
      where: { user_id: userId },
    });

    // Cập nhật profile
    await this.userProfileRepository.update({ user_id: userId }, profileData);

    // Xóa avatar cũ nếu có thay đổi
    if (currentProfile && profileData.avatar) {
      await ImageCleanupHelper.cleanupSingleImage(
        currentProfile.avatar,
        profileData.avatar,
        this.uploadService,
      );
    }

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
    if (operatorRoleCode === RoleCode.ADMIN && [RoleCode.SUPER_ADMIN, RoleCode.ADMIN].includes(targetRoleCode)) {
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
    if (operatorRoleCode === RoleCode.ADMIN && [RoleCode.SUPER_ADMIN, RoleCode.ADMIN].includes(targetRoleCode)) {
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
      if (creatorRoleCode === RoleCode.ADMIN && targetRole.code === RoleCode.ADMIN) {
        throw new Error('Admin cannot create another Admin account');
      }

      if (creatorRoleCode === RoleCode.ADMIN && targetRole.code === RoleCode.SUPER_ADMIN) {
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
      if (approverRoleCode === RoleCode.ADMIN && userRoleCode === RoleCode.ADMIN) {
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
    if (operatorRoleCode === RoleCode.ADMIN && [RoleCode.SUPER_ADMIN, RoleCode.ADMIN].includes(targetRoleCode)) {
      throw new Error('Admin cannot delete Super Admin or other Admin accounts');
    }

    await this.userRepository.softDelete(userId);
  }

  /**
   * Tạo tài khoản đăng nhập cho khách hàng
   * @param customerId - ID của khách hàng cần tạo tài khoản
   * @returns Thông tin tài khoản đã tạo (account và mật khẩu tạm)
   */
  async createCustomerAccount(customerId: number): Promise<{
    account: string;
    temp_password: string;
    customer_name: string;
  }> {
    try {
      // 1. Kiểm tra customer có tồn tại không
      const customer = await this.userRepository.manager
        .getRepository('Customer')
        .findOne({ where: { id: customerId } });

      if (!customer) {
        throw new Error('Khách hàng không tồn tại');
      }

      // 2. Kiểm tra customer đã có tài khoản chưa
      const existingUser = await this.userRepository.findOne({
        where: { customer_id: customerId },
      });

      if (existingUser) {
        throw new Error('Khách hàng đã có tài khoản đăng nhập');
      }

      // 3. Kiểm tra số điện thoại đã được dùng làm account chưa
      const existingAccount = await this.findByAccount(customer.phone);
      if (existingAccount) {
        throw new Error('Số điện thoại này đã được sử dụng làm tài khoản');
      }

      // 4. Lấy role CUSTOMER
      const customerRole = await this.userRepository.manager
        .getRepository('Role')
        .findOne({ where: { code: 'CUSTOMER' } });

      if (!customerRole) {
        throw new Error('Role CUSTOMER chưa được tạo trong hệ thống');
      }

      // 5. Tạo mật khẩu tạm (8 ký tự random)
      const tempPassword = this.generateTempPassword();

      // 6. Hash mật khẩu
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(tempPassword, salt);

      // 7. Tạo user mới
      const user = this.userRepository.create({
        account: customer.phone, // Dùng SĐT làm username
        password: hashedPassword,
        salt: salt,
        role_id: customerRole.id,
        customer_id: customerId,
        status: BaseStatus.ACTIVE, // Customer được active ngay
      });

      await this.userRepository.save(user);

      // 8. Tạo user profile mặc định
      const userProfile = this.userProfileRepository.create({
        user_id: user.id,
        account: user.account,
        nickname: customer.name,
        mobile: customer.phone,
        email: customer.email,
      });
      await this.userProfileRepository.save(userProfile);

      // TODO: Gửi SMS/Email thông báo tài khoản cho customer
      // await this.sendAccountCreatedNotification(customer, tempPassword);

      return {
        account: user.account,
        temp_password: tempPassword,
        customer_name: customer.name,
      };
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'tài khoản khách hàng');
    }
  }

  /**
   * Tạo mật khẩu tạm cố định
   * @returns Mật khẩu tạm (123456)
   */
  private generateTempPassword(): string {
    // Mật khẩu tạm cố định để dễ nhớ
    return '123456';
  }

  /**
   * Tìm kiếm nâng cao người dùng với cấu trúc filter lồng nhau
   */
  async searchUsers(searchDto: SearchUserDto): Promise<{
    data: User[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.userRepository.createQueryBuilder('u');

    // Join profile và role để search và display
    queryBuilder.leftJoinAndSelect('u.profile', 'profile');
    queryBuilder.leftJoinAndSelect('u.role', 'role');

    // Thêm điều kiện mặc định
    queryBuilder.where('u.deleted_at IS NULL');

    // 1. Base Search
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'u',
      ['account', 'profile.nickname', 'profile.email', 'profile.mobile'] // Global search
    );

    // 2. Simple Filters
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'u',
      ['filters', 'nested_filters', 'operator'],
      {
        full_name: 'profile.nickname',
        nickname: 'profile.nickname',
        phone_number: 'profile.mobile',
        email: 'profile.email',
        role: 'role.code',
        role_id: 'u.role_id',
        status: 'u.status',
      }
    );

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Lấy danh sách tất cả các roles
   */
  async getAllRoles() {
    return this.userRepository.manager.find('Role', {
      order: { id: 'ASC' }
    });
  }
}

