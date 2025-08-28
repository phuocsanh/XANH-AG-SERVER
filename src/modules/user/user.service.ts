import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';
import { UserProfile } from '../../entities/user-profile.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FileTrackingService } from '../file-tracking/file-tracking.service';

/**
 * Service xử lý logic nghiệp vụ liên quan đến người dùng
 * Bao gồm tạo, tìm kiếm, cập nhật và xóa thông tin người dùng
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
    // Password is already hashed by AuthService, no need to hash again
    // const hashedPassword = await bcrypt.hash(createUserDto.userPassword, 10);

    // Tạo user
    const user = this.userRepository.create({
      userAccount: createUserDto.userAccount,
      userPassword: createUserDto.userPassword, // Already hashed
      userSalt: createUserDto.userSalt,
    });
    const savedUser = await this.userRepository.save(user);

    // Tạo user profile
    const userProfile = this.userProfileRepository.create({
      userId: savedUser.userId,
      userAccount: createUserDto.userAccount,
      userState: createUserDto.userState || 1,
      userEmail: createUserDto.userEmail,
      userIsAuthentication: 0,
    });
    await this.userProfileRepository.save(userProfile);

    return savedUser;
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
   * @param userId - ID của người dùng cần tìm
   * @returns Thông tin người dùng
   */
  async findOne(userId: number): Promise<User> {
    return this.userRepository.findOne({ where: { userId } });
  }

  /**
   * Tìm người dùng theo tên tài khoản
   * @param userAccount - Tên tài khoản của người dùng cần tìm
   * @returns Thông tin người dùng
   */
  async findByAccount(userAccount: string): Promise<User> {
    return this.userRepository.findOne({ where: { userAccount } });
  }

  /**
   * Cập nhật thông tin người dùng
   * @param userId - ID của người dùng cần cập nhật
   * @param updateUserDto - Dữ liệu cập nhật người dùng
   * @returns Thông tin người dùng đã cập nhật
   */
  async update(userId: number, updateUserDto: UpdateUserDto): Promise<User> {
    await this.userRepository.update(userId, updateUserDto);
    return this.findOne(userId);
  }

  /**
   * Xóa người dùng theo ID
   * @param userId - ID của người dùng cần xóa
   */
  async remove(userId: number): Promise<void> {
    // Xóa tất cả file references liên quan đến người dùng trước khi xóa
    await this.fileTrackingService.batchRemoveEntityFileReferences('User', userId);
    
    // Xóa user profile trước
    await this.userProfileRepository.delete({ userId });
    
    // Xóa người dùng
    await this.userRepository.delete(userId);
  }

  /**
   * Thay đổi mật khẩu người dùng
   * @param userId - ID của người dùng cần thay đổi mật khẩu
   * @param changePasswordDto - Dữ liệu thay đổi mật khẩu
   * @returns true nếu thay đổi thành công, false nếu thất bại
   */
  async changePassword(
    userId: number,
    changePasswordDto: ChangePasswordDto,
  ): Promise<boolean> {
    // Tìm người dùng theo ID
    const user = await this.userRepository.findOne({ where: { userId } });

    if (!user) {
      return false;
    }

    // Kiểm tra mật khẩu cũ
    const isOldPasswordValid = await bcrypt.compare(
      changePasswordDto.oldPassword,
      user.userPassword,
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
      userPassword: hashedNewPassword,
    });

    return true;
  }

  /**
   * Cập nhật thông tin profile người dùng
   * @param userId - ID của người dùng cần cập nhật profile
   * @param profileData - Dữ liệu cập nhật profile
   * @returns Thông tin profile đã cập nhật
   */
  async updateUserProfile(
    userId: number,
    profileData: Partial<UserProfile>,
  ): Promise<UserProfile> {
    await this.userProfileRepository.update({ userId }, profileData);
    return this.userProfileRepository.findOne({ where: { userId } });
  }
}
