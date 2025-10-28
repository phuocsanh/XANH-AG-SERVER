import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, SelectQueryBuilder } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/users.entity';
import { UserProfile } from '../../entities/user-profiles.entity';
import { BaseStatus } from '../../entities/base-status.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FileTrackingService } from '../file-tracking/file-tracking.service';
import { SearchUserDto } from './dto/search-user.dto';
import { FilterConditionDto } from './dto/filter-condition.dto';

/**
 * Service xử lý logic nghiệp vụ liên quan đến người dùng
 * Bao gồm tạo, tìm kiếm, cập nhật và xóa thông tin người dùng
 * Hỗ trợ quản lý trạng thái và xóa mềm
 */
@Injectable()
export class UserService {
  /**
   * Constructor injection các repository và service cần thiết
   * @param userRepository - Repository để thao tác với entity User
   * @param userProfileRepository - Repository để thao tác với entity UserProfile
   * @param fileTrackingService - Service quản lý theo dõi file
   */
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private userProfileRepository: Repository<UserProfile>,
    private fileTrackingService: FileTrackingService,
  ) {}

  /**
   * Tạo người dùng mới
   * @param createUserDto - Dữ liệu tạo người dùng mới
   * @returns Thông tin người dùng đã tạo
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Tạo user (password đã được hash từ AuthService)
    const user = this.userRepository.create({
      account: createUserDto.account,
      password: createUserDto.password, // Password đã được hash từ AuthService
      salt: createUserDto.salt || '', // Use empty string if salt is not provided
      status: BaseStatus.ACTIVE, // Sử dụng BaseStatus thay vì UserStatus
    });
    const savedUser = await this.userRepository.save(user);

    // Tạo user profile
    const userProfileData: Partial<UserProfile> = {
      userId: savedUser.id,
      account: createUserDto.account,
      // userState: createUserDto.userState || 1, // Xóa dòng này vì UserProfile đã có status
      isAuthentication: 0,
      status: BaseStatus.ACTIVE, // Thêm status cho UserProfile
    };

    // Chỉ thêm userEmail nếu có giá trị
    if (createUserDto.email) {
      userProfileData.email = createUserDto.email;
    }

    const userProfile = this.userProfileRepository.create(userProfileData);
    await this.userProfileRepository.save(userProfile);

    return savedUser;
  }

  /**
   * Lấy danh sách tất cả người dùng (không bao gồm đã xóa mềm)
   * @returns Danh sách người dùng (không bao gồm password)
   */
  async findAll(): Promise<User[]> {
    const users = await this.userRepository.find({
      where: { deletedAt: IsNull() },
    });
    // Loại bỏ password khỏi response để bảo mật
    return users.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    });
  }

  /**
   * Tìm người dùng theo ID (không bao gồm đã xóa mềm)
   * @param userId - ID của người dùng cần tìm
   * @returns Thông tin người dùng (không bao gồm password) hoặc null nếu không tìm thấy
   */
  async findOne(userId: number): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: IsNull() },
    });
    if (user) {
      // Loại bỏ password khỏi response để bảo mật
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    }
    return null;
  }

  /**
   * Tìm người dùng theo tên tài khoản (bao gồm cả đã xóa mềm)
   * @param userAccount - Tên tài khoản của người dùng cần tìm
   * @returns Thông tin người dùng hoặc null nếu không tìm thấy
   */
  async findByAccount(account: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { account } });
  }

  /**
   * Lấy danh sách người dùng theo trạng thái
   * @param status - Trạng thái cần lọc
   * @returns Danh sách người dùng có trạng thái tương ứng
   */
  async findByStatus(status: BaseStatus): Promise<User[]> {
    const users = await this.userRepository.find({
      where: { status, deletedAt: IsNull() },
    });
    // Loại bỏ password khỏi response để bảo mật
    return users.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    });
  }

  /**
   * Lấy danh sách người dùng đã bị xóa mềm
   * @returns Danh sách người dùng đã bị xóa mềm
   */
  async findDeleted(): Promise<User[]> {
    const users = await this.userRepository.find({
      withDeleted: true,
    });
    const deletedUsers = users.filter((user) => user.deletedAt !== null);
    // Loại bỏ password khỏi response để bảo mật
    return deletedUsers.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    });
  }

  /**
   * Cập nhật thông tin người dùng
   * @param id - ID của người dùng cần cập nhật
   * @param updateUserDto - Dữ liệu cập nhật người dùng
   * @returns Thông tin người dùng đã cập nhật
   */
  async update(
    userId: number,
    updateUserDto: UpdateUserDto,
  ): Promise<User | null> {
    await this.userRepository.update(userId, updateUserDto);
    return this.findOne(userId);
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
      changePasswordDto.oldPassword,
      user.password,
    );
    if (!isOldPasswordValid) {
      return false;
    }

    // Mã hóa mật khẩu mới
    const hashedNewPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
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
    await this.userProfileRepository.update({ userId }, profileData);
    return this.userProfileRepository.findOne({ where: { userId } });
  }

  /**
   * Kích hoạt người dùng
   * @param id - ID của người dùng cần kích hoạt
   * @returns Thông tin người dùng đã kích hoạt
   */
  async activate(userId: number): Promise<User | null> {
    await this.userRepository.update(userId, { status: BaseStatus.ACTIVE });
    return this.findOne(userId);
  }

  /**
   * Vô hiệu hóa người dùng
   * @param id - ID của người dùng cần vô hiệu hóa
   * @returns Thông tin người dùng đã vô hiệu hóa
   */
  async deactivate(userId: number): Promise<User | null> {
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
   * @returns Thông tin người dùng đã được khôi phục
   */
  async restore(userId: number): Promise<User | null> {
    await this.userRepository.restore(userId);
    return this.findOne(userId);
  }

  /**
   * Xóa vĩnh viễn người dùng (hard delete)
   * @param id - ID của người dùng cần xóa vĩnh viễn
   */
  async remove(userId: number): Promise<void> {
    // Xóa tất cả file references liên quan đến người dùng trước khi xóa
    await this.fileTrackingService.batchRemoveEntityFileReferences(
      'User',
      userId,
    );

    // Xóa user profile trước
    await this.userProfileRepository.delete({ userId });

    // Xóa người dùng vĩnh viễn
    await this.userRepository.delete(userId);
  }

  /**
   * Tìm kiếm nâng cao người dùng
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách người dùng phù hợp
   */
  async searchUsers(searchDto: SearchUserDto): Promise<User[]> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Thêm điều kiện mặc định
    queryBuilder.where('user.deletedAt IS NULL');

    // Xây dựng điều kiện tìm kiếm
    this.buildSearchConditions(queryBuilder, searchDto, 'user');

    const users = await queryBuilder.getMany();

    // Loại bỏ password khỏi response để bảo mật
    return users.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    });
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
    if (searchDto.nestedFilters && searchDto.nestedFilters.length > 0) {
      // Xây dựng điều kiện cho từng bộ lọc lồng nhau
      searchDto.nestedFilters.forEach((nestedFilter) => {
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
      case 'lt':
        parameters[paramName] = filter.value;
        return `${field} < :${paramName}`;
      case 'gte':
        parameters[paramName] = filter.value;
        return `${field} >= :${paramName}`;
      case 'lte':
        parameters[paramName] = filter.value;
        return `${field} <= :${paramName}`;
      case 'like':
        parameters[paramName] = `%${filter.value}%`;
        return `${field} LIKE :${paramName}`;
      case 'ilike':
        parameters[paramName] = `%${filter.value}%`;
        return `LOWER(${field}) LIKE LOWER(:${paramName})`;
      case 'in':
        if (Array.isArray(filter.value)) {
          parameters[paramName] = filter.value;
          return `${field} IN (:...${paramName})`;
        }
        return null;
      case 'notin':
        if (Array.isArray(filter.value)) {
          parameters[paramName] = filter.value;
          return `${field} NOT IN (:...${paramName})`;
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
