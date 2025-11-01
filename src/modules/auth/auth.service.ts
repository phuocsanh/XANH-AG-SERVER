import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { User } from '../../entities/users.entity';
import { CreateUserDto } from '../user/dto/create-user.dto';

/**
 * Service xử lý logic xác thực và ủy quyền người dùng
 * Bao gồm xác thực thông tin đăng nhập, tạo token JWT và đăng ký người dùng
 */
@Injectable()
export class AuthService {
  /**
   * Constructor injection các service cần thiết
   * @param userService - Service xử lý logic người dùng
   * @param jwtService - Service xử lý token JWT
   */
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  /**
   * Xác thực thông tin đăng nhập của người dùng
   * @param userAccount - Tên tài khoản người dùng
   * @param pass - Mật khẩu người dùng
   * @returns Thông tin người dùng nếu xác thực thành công, null nếu thất bại
   */
  async validateUser(userAccount: string, pass: string): Promise<any> {
    // Tìm người dùng theo tên tài khoản
    const user = await this.userService.findByAccount(userAccount);
    if (user) {
      // So sánh mật khẩu đã hash với mật khẩu nhập vào
      const isPasswordValid = await bcrypt.compare(pass, user.password);
      if (isPasswordValid) {
        // Loại bỏ mật khẩu khỏi kết quả trả về
        const { password, ...result } = user;
        return result;
      }
    }
    return null;
  }

  /**
   * Tạo token JWT cho người dùng đã xác thực
   * @param user - Thông tin người dùng đã xác thực
   * @returns Token JWT và thông tin người dùng
   */
  async login(user: User) {
    // Tạo payload cho token JWT
    const payload = {
      userAccount: user.account,
      sub: user.id,
      userId: user.id,
    };

    return {
      access_token: this.jwtService.sign(payload), // Token JWT để xác thực các request sau này
      refresh_token: this.jwtService.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
        expiresIn: '7d', // Refresh token có thời gian dài hơn (7 ngày)
      }),
      user: {
        userId: user.id,
        userAccount: user.account,
      },
    };
  }

  /**
   * Tạo refresh token mới từ payload
   * @param payload - Dữ liệu payload để tạo token
   * @returns Refresh token mới
   */
  async createRefreshToken(payload: any) {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
      expiresIn: '7d',
    });
  }

  /**
   * Xác thực refresh token
   * @param refreshToken - Refresh token cần xác thực
   * @returns Payload nếu token hợp lệ, null nếu không hợp lệ
   */
  async validateRefreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
      });
      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Làm mới access token từ refresh token
   * @param refreshToken - Refresh token để tạo access token mới
   * @returns Access token mới và refresh token mới
   */
  async refreshToken(refreshToken: string) {
    const payload = await this.validateRefreshToken(refreshToken);
    if (!payload) {
      return null;
    }

    // Tạo payload mới cho token
    const newPayload = {
      userAccount: payload.userAccount,
      sub: payload.sub,
      userId: payload.userId,
    };

    return {
      access_token: this.jwtService.sign(newPayload),
      refresh_token: await this.createRefreshToken(newPayload),
    };
  }

  /**
   * Đăng ký người dùng mới
   * @param createUserDto - Dữ liệu tạo người dùng mới
   * @returns Thông tin người dùng đã tạo (không bao gồm mật khẩu)
   */
  async register(createUserDto: CreateUserDto) {
    // Tạo người dùng - mật khẩu sẽ được hash trong UserService.create
    const user = await this.userService.create(createUserDto);

    // Trả về thông tin người dùng không bao gồm mật khẩu
    const { password, ...result } = user;
    return result;
  }

  /**
   * Hash mật khẩu sử dụng bcrypt và trả về cả mật khẩu đã hash và salt
   * @param password - Mật khẩu cần hash
   * @returns Mật khẩu đã hash và salt
   */
  async hashPasswordWithSalt(
    password: string,
  ): Promise<{ hashedPassword: string; salt: string }> {
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);
    return { hashedPassword, salt };
  }

  /**
   * Hash mật khẩu sử dụng bcrypt
   * @param password - Mật khẩu cần hash
   * @returns Mật khẩu đã hash
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10; // Số vòng salt để tăng độ bảo mật
    return await bcrypt.hash(password, saltRounds);
  }
}
