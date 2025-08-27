import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * Controller xử lý các request liên quan đến người dùng
 * Cung cấp các API để quản lý thông tin người dùng
 */
@Controller('users')
export class UserController {
  /**
   * Constructor injection UserService
   * @param userService - Service xử lý logic nghiệp vụ người dùng
   */
  constructor(private readonly userService: UserService) {}

  /**
   * Tạo mới người dùng
   * @param createUserDto - Dữ liệu tạo người dùng
   * @returns Thông tin người dùng đã tạo
   */
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  /**
   * Lấy thông tin profile của người dùng hiện tại
   * Yêu cầu xác thực JWT
   * @param user - Thông tin người dùng từ token
   * @returns Thông tin profile người dùng
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Body() user: any) {
    return user;
  }

  /**
   * Lấy danh sách tất cả người dùng
   * @returns Danh sách người dùng
   */
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  /**
   * Lấy thông tin chi tiết một người dùng theo ID
   * @param id - ID của người dùng cần tìm
   * @returns Thông tin người dùng
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  /**
   * Cập nhật thông tin người dùng
   * Yêu cầu xác thực JWT
   * @param id - ID của người dùng cần cập nhật
   * @param updateUserDto - Dữ liệu cập nhật người dùng
   * @returns Thông tin người dùng đã cập nhật
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(+id, updateUserDto);
  }

  /**
   * Xóa người dùng theo ID
   * Yêu cầu xác thực JWT
   * @param id - ID của người dùng cần xóa
   * @returns Kết quả xóa người dùng
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }
}
