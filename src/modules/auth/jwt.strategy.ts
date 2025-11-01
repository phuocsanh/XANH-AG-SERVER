import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Strategy xử lý xác thực JWT (JSON Web Token)
 * Được sử dụng để xác thực người dùng từ token trong header của request
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  /**
   * Constructor cấu hình JWT strategy
   */
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Trích xuất token từ header Authorization
      ignoreExpiration: false, // Không bỏ qua thời gian hết hạn của token
      secretOrKey: process.env.JWT_SECRET || 'my_jwt_secret_key', // Secret key để xác minh token
    });
  }

  /**
   * Phương thức validate để xác thực người dùng từ payload của token
   * @param payload - Dữ liệu được giải mã từ token
   * @returns Dữ liệu người dùng được truyền vào request
   */
  async validate(payload: any) {
    this.logger.log(`Validating JWT payload: ${JSON.stringify(payload)}`);
    // Trả về payload để có thể truy cập trong request.user
    return payload;
  }
}
