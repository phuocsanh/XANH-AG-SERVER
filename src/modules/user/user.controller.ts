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
import { CreateCustomerAccountDto } from './dto/create-customer-account.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
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
   * Lấy danh sách roles
   */
  @Get('roles-list')
  @UseGuards(JwtAuthGuard)
  getRoles() {
    return this.userService.getAllRoles();
  }

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
   * Endpoint lấy thông tin profile của user đang đăng nhập
   * Không cần permission đặc biệt - chỉ cần đăng nhập
   * @param req - Request object chứa thông tin user đang đăng nhập
   * @returns Thông tin user với profile
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Req() req: any) {
    return this.userService.findOne(req.user.id);
  }


  /**
   * Endpoint cập nhật FCM token của người dùng hiện tại
   * @param req - Request chứa thông tin user
   * @param fcmToken - FCM token nhận từ client
   */
  @Put('fcm-token')
  @UseGuards(JwtAuthGuard)
  async updateFcmToken(@Req() req: any, @Body('fcm_token') fcmToken: string) {
    return this.userService.updateUserProfile(req.user.id, { fcm_token: fcmToken });
  }

  /**
   * Endpoint tìm người dùng theo ID
   * @param id - ID của người dùng cần tìm
   * @returns Thông tin người dùng
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:read')
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
  @RequirePermissions('user:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto);
  }

  /**
   * Endpoint xóa người dùng
   * @param id - ID của người dùng cần xóa
   * @param req - Request object chứa thông tin user đang đăng nhập
   * @returns Kết quả xóa người dùng
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:delete')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const operatorRoleCode = req.user.role.code;
    return this.userService.remove(id, operatorRoleCode);
  }

  /**
   * Endpoint tìm kiếm nâng cao người dùng
   * @param searchUserDto - Điều kiện tìm kiếm
   * @returns Danh sách người dùng phù hợp với thông tin phân trang
   */
  @Post('search')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:read')
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
  @RequirePermissions('user:create')
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
  @RequirePermissions('user:approve')
  async approveUser(@Body() approveUserDto: any, @Req() req: any) {
    const approverRoleCode = req.user.role.code;
    return this.userService.approveUser(approveUserDto.user_id, approverRoleCode);
  }



  /**
   * Endpoint kích hoạt tài khoản người dùng
   * @param id - ID của người dùng cần kích hoạt
   * @param req - Request object chứa thông tin user đang đăng nhập
   * @returns Thông tin người dùng đã kích hoạt
   */
  @Post(':id/activate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async activateUser(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const operatorRoleCode = req.user.role.code;
    return this.userService.activate(id, operatorRoleCode);
  }

  /**
   * Endpoint vô hiệu hóa tài khoản người dùng
   * @param id - ID của người dùng cần vô hiệu hóa
   * @param req - Request object chứa thông tin user đang đăng nhập
   * @returns Thông tin người dùng đã vô hiệu hóa
   */
  @Post(':id/deactivate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async deactivateUser(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const operatorRoleCode = req.user.role.code;
    return this.userService.deactivate(id, operatorRoleCode);
  }

  /**
   * Endpoint tạo tài khoản đăng nhập cho khách hàng
   * @param createCustomerAccountDto - Dữ liệu tạo tài khoản (customer_id)
   * @returns Thông tin tài khoản đã tạo (account và mật khẩu tạm)
   */
  @Post('customer/create-account')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('customer:manage')
  async createCustomerAccount(@Body() createCustomerAccountDto: CreateCustomerAccountDto) {
    return this.userService.createCustomerAccount(createCustomerAccountDto.customer_id);
  }

  /**
   * Endpoint đặt lại mật khẩu người dùng bởi Admin
   * @param id - ID của người dùng cần đặt lại mật khẩu
   * @param resetPasswordDto - Mật khẩu mới
   */
  @Post(':id/reset-password')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user:update')
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() resetPasswordDto: ResetPasswordDto,
  ) {
    return this.userService.resetPassword(id, resetPasswordDto.password);
  }


}
