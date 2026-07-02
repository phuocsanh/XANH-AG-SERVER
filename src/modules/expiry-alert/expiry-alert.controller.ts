import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ExpiryAlertService } from './expiry-alert.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('expiry-alert')
@UseGuards(JwtAuthGuard)
export class ExpiryAlertController {
  constructor(private readonly expiryAlertService: ExpiryAlertService) {}

  /**
   * Kích hoạt quét hạn dùng thủ công (SUPER_ADMIN)
   */
  @Post('check')
  @RequirePermissions('inventory:manage')
  async manualCheck() {
    return this.expiryAlertService.checkAndCreateAlerts();
  }

  /**
   * Lấy thống kê tổng hợp cảnh báo hết hạn
   */
  @Get('stats')
  @RequirePermissions('inventory:read')
  async getStats() {
    return this.expiryAlertService.getAlertStats();
  }

  /**
   * Lấy danh sách cảnh báo có phân trang và bộ lọc
   * Query params: status (pending|resolved), type (warning|critical|expired), page, limit
   */
  @Get()
  @RequirePermissions('inventory:read')
  async getAlerts(
    @Query('status') status?: 'pending' | 'resolved',
    @Query('type') type?: 'warning' | 'critical' | 'expired',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.expiryAlertService.getAlertsPaginated({
      ...(status && { status }),
      ...(type && { type }),
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  /**
   * Lấy lịch sử cảnh báo không phân trang (dùng cho filter đơn giản)
   */
  @Get('history')
  @RequirePermissions('inventory:read')
  async getHistory(@Query() filters: any) {
    return this.expiryAlertService.getAlertHistory(filters);
  }

  /**
   * Lấy danh sách lô hàng của một sản phẩm (FEFO)
   */
  @Get('product/:productId/batches')
  @RequirePermissions('inventory:read')
  async getBatchesByProduct(@Param('productId') productId: string) {
    return this.expiryAlertService.getBatchesByProduct(Number(productId));
  }

  /**
   * Đánh dấu một cảnh báo đã xử lý
   */
  @Patch(':id/resolve')
  @RequirePermissions('inventory:manage')
  async resolveAlert(
    @Param('id') id: string,
    @Body('notes') notes: string,
  ) {
    return this.expiryAlertService.resolveAlert(Number(id), notes);
  }

  /**
   * Đánh dấu nhiều cảnh báo đã xử lý cùng lúc
   */
  @Post('resolve-multiple')
  @RequirePermissions('inventory:manage')
  async resolveMultiple(
    @Body('ids') ids: number[],
    @Body('notes') notes?: string,
  ) {
    return this.expiryAlertService.resolveMultiple(ids, notes);
  }
}
