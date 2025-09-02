import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { LocalStrategy } from './local.strategy';
import { RefreshJwtStrategy } from './refresh-jwt.strategy';
import { User } from '../../entities/users.entity';

/**
 * Module xử lý xác thực và ủy quyền người dùng
 * Cung cấp các tính năng đăng nhập, đăng xuất và bảo vệ route
 */
@Module({
  imports: [
    // Import UserModule để sử dụng UserService trong xác thực
    UserModule,

    // Import PassportModule để sử dụng Passport.js cho xác thực
    PassportModule,

    // Cấu hình JwtModule với secret key và thời gian hết hạn
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key', // Secret key để ký và xác minh token
      signOptions: { expiresIn: '1h' }, // Thời gian hết hạn của token (1 giờ)
    }),
  ],
  controllers: [AuthController], // Controller xử lý các request liên quan đến xác thực
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    RefreshJwtStrategy, // Thêm RefreshJwtStrategy để xử lý refresh token
  ], // Các service và strategy cho xác thực
  exports: [AuthService], // Xuất AuthService để các module khác có thể sử dụng
})
export class AuthModule {}
