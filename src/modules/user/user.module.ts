import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { UserProfile } from '../../entities/user-profile.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';

/**
 * Module quản lý người dùng
 * Cung cấp các chức năng liên quan đến quản lý thông tin người dùng
 */
@Module({
  imports: [
    // Import TypeORM feature module với các entity User và UserProfile
    TypeOrmModule.forFeature([User, UserProfile]),
  ],
  controllers: [UserController], // Controller xử lý các request liên quan đến người dùng
  providers: [UserService], // Service xử lý logic nghiệp vụ người dùng
  exports: [UserService], // Xuất UserService để các module khác có thể sử dụng
})
export class UserModule {}
