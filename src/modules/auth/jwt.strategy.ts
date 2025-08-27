import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';

/**
 * Strategy xử lý xác thực JWT (JSON Web Token)
 * Được sử dụng để xác thực người dùng từ token trong header của request
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * Constructor cấu hình JWT strategy
   * @param userService - Service để lấy thông tin người dùng từ database
   */
  constructor(private userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Trích xuất token từ header Authorization
      ignoreExpiration: false, // Không bỏ qua thời gian hết hạn của token
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key', // Secret key để xác minh token
    });
  }

  /**
   * Phương thức validate để xác thực người dùng từ payload của token
   * @param payload - Dữ liệu từ token JWT
   * @returns Thông tin người dùng nếu hợp lệ, null nếu không hợp lệ
   */
  async validate(payload: any) {
    // Lấy thông tin người dùng từ database để đảm bảo người dùng vẫn tồn tại
    const user = await this.userService.findOne(payload.userId || payload.sub);
    if (!user) {
      return null;
    }
    return user;
  }
}
