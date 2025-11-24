import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/users.entity';
import { UserProfile } from '../../entities/user-profiles.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { FileTrackingModule } from '../file-tracking/file-tracking.module';
import { UniqueAccountValidator } from './validators/unique-account.validator';

/**
 * UserModule - Module quản lý người dùng
 * 
 * Module này cung cấp các chức năng:
 * - Quản lý thông tin người dùng và hồ sơ cá nhân
 * - Tạo, cập nhật, xóa tài khoản người dùng
 * - Quản lý avatar và thông tin liên hệ
 * - Validate tính duy nhất của tài khoản
 * - Phân quyền và quản lý vai trò người dùng
 */
@Module({
  imports: [
    // Import TypeORM feature module với các entity User và UserProfile
    TypeOrmModule.forFeature([User, UserProfile]),
    // Import FileTrackingModule để sử dụng FileTrackingService
    FileTrackingModule,
  ],
  controllers: [UserController], // Controller xử lý các request liên quan đến người dùng
  providers: [
    UserService,
    UniqueAccountValidator, // Add validator to providers
  ], // Service xử lý logic nghiệp vụ người dùng
  exports: [UserService], // Xuất UserService để các module khác có thể sử dụng
})
export class UserModule {}
