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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  // Debug endpoints removed - authentication is working properly

  // Thêm endpoint đổi mật khẩu
  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  @UseInterceptors(ClassSerializerInterceptor)
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const userId = req.user.userId;
    const isPasswordChanged = await this.userService.changePassword(
      userId,
      changePasswordDto,
    );

    if (!isPasswordChanged) {
      return { success: false, message: 'Failed to change password' };
    }

    return { success: true, message: 'Password changed successfully' };
  }
}
