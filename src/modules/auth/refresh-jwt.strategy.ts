import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';

/**
 * Strategy xử lý xác thực refresh token JWT
 * Được sử dụng để xác thực refresh token trong header của request
 */
@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  /**
   * Constructor cấu hình refresh JWT strategy
   * @param userService - Service để lấy thông tin người dùng từ database
   */
  constructor(private userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refresh_token'), // Trích xuất refresh token từ body field
      ignoreExpiration: false, // Không bỏ qua thời gian hết hạn của token
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key', // Secret key để xác minh refresh token
      passReqToCallback: true, // Cho phép truyền request vào callback
    });
  }

  /**
   * Phương thức validate để xác thực người dùng từ payload của refresh token
   * @param req - Request object
   * @param payload - Dữ liệu từ refresh token JWT
   * @returns Thông tin người dùng nếu hợp lệ
   */
  async validate(req: Request, payload: any) {
    // Lấy thông tin người dùng từ database để đảm bảo người dùng vẫn tồn tại
    const user = await this.userService.findOne(payload.userId || payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
