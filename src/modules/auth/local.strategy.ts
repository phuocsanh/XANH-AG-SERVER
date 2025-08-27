import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Strategy xử lý xác thực local (tên người dùng/mật khẩu)
 * Được sử dụng để xác thực người dùng khi đăng nhập bằng tài khoản và mật khẩu
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  /**
   * Constructor cấu hình local strategy
   * @param authService - Service để xác thực thông tin đăng nhập
   */
  constructor(private authService: AuthService) {
    super({
      usernameField: 'userAccount', // Trường dùng làm tên người dùng
      passwordField: 'userPassword', // Trường dùng làm mật khẩu
    });
  }

  /**
   * Phương thức validate để xác thực thông tin đăng nhập
   * @param userAccount - Tên tài khoản người dùng
   * @param userPassword - Mật khẩu người dùng
   * @returns Thông tin người dùng nếu xác thực thành công
   * @throws UnauthorizedException nếu thông tin đăng nhập không hợp lệ
   */
  async validate(userAccount: string, userPassword: string): Promise<any> {
    // Gọi authService để xác thực thông tin đăng nhập
    const user = await this.authService.validateUser(userAccount, userPassword);
    if (!user) {
      // Nếu không xác thực được, throw exception
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}
