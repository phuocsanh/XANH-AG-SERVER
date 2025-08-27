import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Put,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { ChangePasswordDto } from '../user/dto/change-password.dto';
import { UserService } from '../user/user.service';

/**
 * Controller xử lý các request liên quan đến xác thực người dùng
 * Bao gồm đăng nhập, đăng ký và thay đổi mật khẩu
 */
@Controller('auth')
export class AuthController {
  /**
   * Constructor injection các service cần thiết
   * @param authService - Service xử lý logic xác thực
   * @param userService - Service xử lý logic người dùng
   */
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  /**
   * Endpoint đăng nhập người dùng
   * Sử dụng LocalAuthGuard để xác thực thông tin đăng nhập
   * @param req - Request object chứa thông tin người dùng đã xác thực
   * @returns Thông tin xác thực bao gồm access token
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  /**
   * Endpoint đăng ký người dùng mới
   * @param createUserDto - Dữ liệu tạo người dùng mới
   * @returns Thông tin người dùng đã tạo
   */
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  // Debug endpoints removed - authentication is working properly

  /**
   * Endpoint thay đổi mật khẩu người dùng
   * Yêu cầu xác thực JWT
   * @param req - Request object chứa thông tin người dùng từ token
   * @param changePasswordDto - Dữ liệu thay đổi mật khẩu
   * @returns Kết quả thay đổi mật khẩu
   */
  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  @UseInterceptors(ClassSerializerInterceptor)
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    // Lấy ID người dùng từ token
    const userId = req.user.userId;

    // Gọi service để thay đổi mật khẩu
    const isPasswordChanged = await this.userService.changePassword(
      userId,
      changePasswordDto,
    );

    // Trả về kết quả thay đổi mật khẩu
    if (!isPasswordChanged) {
      return { success: false, message: 'Failed to change password' };
    }

    return { success: true, message: 'Password changed successfully' };
  }
}
