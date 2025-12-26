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
import { SalesService } from './sales.service';
import { CreateDeliveryLogDto } from './dto/delivery-log.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Controller xử lý các request liên quan đến quản lý giao hàng
 * Bao gồm tạo, xem, sửa, xóa phiếu giao hàng
 */
@Controller('delivery-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeliveryController {
  constructor(private readonly salesService: SalesService) {}

  /**
   * Tạo phiếu giao hàng mới (standalone - không kèm hóa đơn)
   * @param createDeliveryLogDto - Dữ liệu tạo phiếu giao hàng
   * @param userId - ID người tạo
   * @returns Thông tin phiếu giao hàng đã tạo
   */
  @Post()
  @RequirePermissions('sales:create')
  createDeliveryLog(
    @Body() createDeliveryLogDto: CreateDeliveryLogDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.salesService.createStandaloneDeliveryLog(createDeliveryLogDto, userId);
  }

  /**
   * Tìm kiếm phiếu giao hàng với phân trang (POST)
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách phiếu giao hàng với thông tin phân trang
   */
  @Post('search')
  @RequirePermissions('sales:read')
  search(@Body() searchDto: any) {
    return this.salesService.findAllDeliveryLogs(searchDto);
  }

  /**
   * Lấy chi tiết phiếu giao hàng theo ID
   * @param id - ID của phiếu giao hàng
   * @returns Thông tin chi tiết phiếu giao hàng
   */
  @Get(':id')
  @RequirePermissions('sales:read')
  findOne(@Param('id') id: string) {
    return this.salesService.findOneDeliveryLog(+id);
  }

  /**
   * Cập nhật thông tin phiếu giao hàng
   * @param id - ID của phiếu giao hàng cần cập nhật
   * @param updateData - Dữ liệu cập nhật
   * @returns Thông tin phiếu giao hàng đã cập nhật
   */
  @Patch(':id')
  @RequirePermissions('sales:manage')
  update(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateDeliveryLogDto>,
  ) {
    return this.salesService.updateDeliveryLog(+id, updateData);
  }

  /**
   * Xóa phiếu giao hàng
   * @param id - ID của phiếu giao hàng cần xóa
   * @returns Kết quả xóa
   */
  @Delete(':id')
  @RequirePermissions('sales:manage')
  remove(@Param('id') id: string) {
    return this.salesService.removeDeliveryLog(+id);
  }

  /**
   * Cập nhật trạng thái phiếu giao hàng
   * @param id - ID của phiếu giao hàng
   * @param status - Trạng thái mới
   * @returns Thông tin phiếu giao hàng đã cập nhật
   */
  @Patch(':id/status')
  @RequirePermissions('sales:manage')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.salesService.updateDeliveryStatus(+id, status);
  }
}
