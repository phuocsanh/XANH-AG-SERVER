import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseInterceptors,
  ClassSerializerInterceptor,
  ParseIntPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUserDto } from './dto/search-user.dto';

/**
 * Controller xử lý các request liên quan đến người dùng
 * Bao gồm các thao tác CRUD và tìm kiếm nâng cao
 */
@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  /**
   * Constructor injection service cần thiết
   * @param userService - Service xử lý logic người dùng
   */
  constructor(private readonly userService: UserService) {}

  /**
   * Endpoint tạo người dùng mới
   * @param createUserDto - Dữ liệu tạo người dùng mới
   * @returns Thông tin người dùng đã tạo
   */
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  /**
   * Endpoint lấy danh sách tất cả người dùng
   * @returns Danh sách người dùng
   */
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  /**
   * Endpoint tìm người dùng theo ID
   * @param id - ID của người dùng cần tìm
   * @returns Thông tin người dùng
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  /**
   * Endpoint cập nhật thông tin người dùng
   * @param id - ID của người dùng cần cập nhật
   * @param updateUserDto - Dữ liệu cập nhật người dùng
   * @returns Thông tin người dùng đã cập nhật
   */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto);
  }

  /**
   * Endpoint xóa người dùng
   * @param id - ID của người dùng cần xóa
   * @returns Kết quả xóa người dùng
   */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }

  /**
   * Endpoint tìm kiếm nâng cao người dùng
   * @param searchUserDto - Điều kiện tìm kiếm
   * @returns Danh sách người dùng phù hợp với thông tin phân trang
   */
  @Post('search')
  search(@Body() searchUserDto: SearchUserDto) {
    return this.userService.searchUsers(searchUserDto);
  }
}
