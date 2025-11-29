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
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUserDto } from './dto/search-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('USER_VIEW')
  findAll() {
    return this.userService.findAll();
  }

  /**
   * Endpoint tìm người dùng theo ID
   * @param id - ID của người dùng cần tìm
   * @returns Thông tin người dùng
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('USER_VIEW')
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('USER_UPDATE')
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('USER_DELETE')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }

  /**
   * Endpoint tìm kiếm nâng cao người dùng
   * @param searchUserDto - Điều kiện tìm kiếm
   * @returns Danh sách người dùng phù hợp với thông tin phân trang
   */
  @Post('search')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('USER_VIEW')
  search(@Body() searchUserDto: SearchUserDto) {
    return this.userService.searchUsers(searchUserDto);
  }

  /**
   * Endpoint tạo tài khoản bởi Admin/Super Admin
   * @param createUserByAdminDto - Dữ liệu tạo người dùng
   * @param req - Request object chứa thông tin user đang đăng nhập
   * @returns Thông tin người dùng đã tạo
   */
  @Post('admin/create')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('USER_CREATE')
  async createByAdmin(@Body() createUserByAdminDto: any, @Req() req: any) {
    const creatorRoleCode = req.user.role.code;
    return this.userService.createByAdmin(createUserByAdminDto, creatorRoleCode);
  }

  /**
   * Endpoint duyệt tài khoản người dùng
   * @param approveUserDto - Dữ liệu duyệt người dùng
   * @param req - Request object chứa thông tin user đang đăng nhập
   * @returns Thông tin người dùng đã duyệt
   */
  @Post('admin/approve')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('USER_APPROVE')
  async approveUser(@Body() approveUserDto: any, @Req() req: any) {
    const approverRoleCode = req.user.role.code;
    return this.userService.approveUser(approveUserDto.user_id, approverRoleCode);
  }

  /**
   * Endpoint lấy danh sách người dùng chờ duyệt
   * @returns Danh sách người dùng chờ duyệt
   */
  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('USER_VIEW')
  async getPendingUsers() {
    return this.userService.getPendingUsers();
  }
}
