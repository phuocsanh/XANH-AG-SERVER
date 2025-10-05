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
import { UserStatus } from '../../entities/users.entity';

/**
 * Controller xử lý các request liên quan đến người dùng
 * Cung cấp các API để quản lý thông tin người dùng
 * Hỗ trợ quản lý trạng thái và xóa mềm
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
   * Lấy danh sách người dùng theo trạng thái
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @returns Danh sách người dùng có trạng thái tương ứng
   */
  @Get('status/:status')
  findByStatus(@Param('status') status: UserStatus) {
    return this.userService.findByStatus(status);
  }

  /**
   * Lấy danh sách người dùng đã bị xóa mềm
   * @returns Danh sách người dùng đã bị xóa mềm
   */
  @Get('deleted')
  findDeleted() {
    return this.userService.findDeleted();
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
   * Kích hoạt người dùng (chuyển trạng thái thành ACTIVE)
   * @param id - ID của người dùng cần kích hoạt
   * @returns Thông tin người dùng đã được kích hoạt
   */
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.userService.activate(+id);
  }

  /**
   * Vô hiệu hóa người dùng (chuyển trạng thái thành INACTIVE)
   * @param id - ID của người dùng cần vô hiệu hóa
   * @returns Thông tin người dùng đã được vô hiệu hóa
   */
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.userService.deactivate(+id);
  }

  /**
   * Lưu trữ người dùng (chuyển trạng thái thành ARCHIVED)
   * @param id - ID của người dùng cần lưu trữ
   * @returns Thông tin người dùng đã được lưu trữ
   */
  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.userService.archive(+id);
  }

  /**
   * Xóa mềm người dùng (soft delete)
   * @param id - ID của người dùng cần xóa mềm
   * @returns Thông tin người dùng đã được xóa mềm
   */
  @Delete(':id/soft')
  softRemove(@Param('id') id: string) {
    return this.userService.softRemove(+id);
  }

  /**
   * Khôi phục người dùng đã bị xóa mềm
   * @param id - ID của người dùng cần khôi phục
   * @returns Thông tin người dùng đã được khôi phục
   */
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.userService.restore(+id);
  }

  /**
   * Xóa vĩnh viễn người dùng (hard delete)
   * Yêu cầu xác thực JWT
   * @param id - ID của người dùng cần xóa vĩnh viễn
   * @returns Kết quả xóa người dùng
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }
}
