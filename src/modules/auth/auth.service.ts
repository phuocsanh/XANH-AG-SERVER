import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { User } from '../../entities/user.entity';
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
      const isPasswordValid = await bcrypt.compare(pass, user.userPassword);
      if (isPasswordValid) {
        // Loại bỏ mật khẩu khỏi kết quả trả về
        const { userPassword, ...result } = user;
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
      userAccount: user.userAccount,
      sub: user.userId,
      userId: user.userId,
    };

    return {
      access_token: this.jwtService.sign(payload), // Token JWT để xác thực các request sau này
      user: {
        userId: user.userId,
        userAccount: user.userAccount,
      },
    };
  }

  /**
   * Đăng ký người dùng mới
   * @param createUserDto - Dữ liệu tạo người dùng mới
   * @returns Thông tin người dùng đã tạo (không bao gồm mật khẩu)
   */
  async register(createUserDto: CreateUserDto) {
    // Hash mật khẩu trước khi lưu vào database
    const hashedPassword = await this.hashPassword(createUserDto.userPassword);

    // Tạo người dùng với mật khẩu đã hash
    const user = await this.userService.create({
      ...createUserDto,
      userPassword: hashedPassword,
    });

    // Trả về thông tin người dùng không bao gồm mật khẩu
    const { userPassword, ...result } = user;
    return result;
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
