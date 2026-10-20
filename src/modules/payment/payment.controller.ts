import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { SearchPaymentDto } from './dto/search-payment.dto';
import { SettleDebtDto } from './dto/settle-debt.dto';
import { RollbackPaymentDto } from './dto/rollback-payment.dto';
import { SearchPaymentRollbackHistoryDto } from './dto/search-payment-rollback-history.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RoleCode } from '../../common/enums/role-code.enum';

/**
 * Chặn các thao tác hoàn tác phiếu thu với tài khoản không phải SUPER_ADMIN.
 * Quy định hiện tại: chỉ Super Admin được hoàn tác thu để tránh tự ý đảo công nợ.
 */
function assertSuperAdmin(user: any, action: string) {
  if (user?.role?.code !== RoleCode.SUPER_ADMIN) {
    throw new ForbiddenException(`Chỉ Super Admin mới được ${action}`);
  }
}


@Controller('payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}


  @Post('settle-debt')
  @RequirePermissions('sales:manage')
  settleDebt(
    @Body() dto: SettleDebtDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.paymentService.settleDebt(dto, userId);
  }



  @Post('search')
  @RequirePermissions('sales:read')
  search(@Body() searchDto: SearchPaymentDto) {
    return this.paymentService.search(searchDto);
  }

  /**
   * Lịch sử hoàn tác phiếu thu (đối soát).
   * Phải khai báo trước route `:id` để không bị hiểu là id.
   */
  @Get('rollback-history')
  @RequirePermissions('sales:read')
  searchRollbackHistory(@Query() dto: SearchPaymentRollbackHistoryDto) {
    return this.paymentService.searchRollbackHistory(dto);
  }

  /** Xem trước ảnh hưởng và lý do chặn trước khi hoàn tác (chỉ Super Admin). */
  @Get(':id/rollback-preview')
  @RequirePermissions('sales:read')
  getRollbackPreview(@Param('id') id: string, @CurrentUser() user: any) {
    assertSuperAdmin(user, 'xem trước hoàn tác phiếu thu');
    return this.paymentService.getRollbackPreview(+id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentService.findOne(+id);
  }

  /**
   * Chỉ cho sửa thông tin phụ (ghi chú/ngày thu/hình thức).
   * Số tiền và khách hàng bị chặn ở service để không làm lệch công nợ.
   */
  @Patch(':id')
  @RequirePermissions('sales:manage')
  update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return this.paymentService.update(+id, updatePaymentDto);
  }

  @Get(':id/allocations')
  @RequirePermissions('sales:read')
  getPaymentAllocations(@Param('id') id: string) {
    return this.paymentService.getPaymentAllocations(+id);
  }

  /**
   * Hoàn tác phiếu thu (xóa ghi nhận thu, khôi phục công nợ/tích lũy).
   * Bắt buộc nhập lý do để lưu vết đối soát.
   * Chỉ SUPER_ADMIN được phép hoàn tác.
   */
  @Post(':id/rollback')
  @RequirePermissions('sales:manage')
  rollback(
    @Param('id') id: string,
    @Body() dto: RollbackPaymentDto,
    @CurrentUser('id') userId: number,
    @CurrentUser() user: any,
  ) {
    assertSuperAdmin(user, 'hoàn tác phiếu thu');
    return this.paymentService.rollbackPayment(+id, dto, userId);
  }
}

