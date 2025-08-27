import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';
import { UserProfile } from '../../entities/user-profile.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserProfile)
    private userProfileRepository: Repository<UserProfile>,
  ) {}

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

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findOne(userId: number): Promise<User> {
    return this.userRepository.findOne({ where: { userId } });
  }

  async findByAccount(userAccount: string): Promise<User> {
    return this.userRepository.findOne({ where: { userAccount } });
  }

  async update(userId: number, updateUserDto: UpdateUserDto): Promise<User> {
    await this.userRepository.update(userId, updateUserDto);
    return this.findOne(userId);
  }

  async remove(userId: number): Promise<void> {
    await this.userRepository.delete(userId);
  }

  async changePassword(
    userId: number,
    changePasswordDto: ChangePasswordDto,
  ): Promise<boolean> {
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

  async updateUserProfile(
    userId: number,
    profileData: Partial<UserProfile>,
  ): Promise<UserProfile> {
    await this.userProfileRepository.update({ userId }, profileData);
    return this.userProfileRepository.findOne({ where: { userId } });
  }
}
