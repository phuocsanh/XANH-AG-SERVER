import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';

/**
 * Strategy xử lý xác thực JWT (JSON Web Token)
 * Được sử dụng để xác thực người dùng từ token trong header của request
 * Tự động load role và permissions của user
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  /**
   * Constructor cấu hình JWT strategy
   */
  constructor(private userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Trích xuất token từ header Authorization
      ignoreExpiration: false, // Không bỏ qua thời gian hết hạn của token
      secretOrKey: process.env.JWT_SECRET || 'my_jwt_secret_key', // Secret key để xác minh token
    });
  }

  /**
   * Phương thức validate để xác thực người dùng từ payload của token
   * Load đầy đủ thông tin user, role và permissions từ database
   * @param payload - Dữ liệu được giải mã từ token
   * @returns Dữ liệu người dùng đầy đủ được truyền vào request.user
   */
  async validate(payload: any) {
    this.logger.log(`Validating JWT for user ID: ${payload.userId}`);
    
    // Load user từ database với role và permissions
    const user = await this.userService.findOneWithPermissions(payload.userId);
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('User account is not active');
    }

    // Trả về user object đầy đủ để có thể truy cập trong request.user
    return user;
  }
}
