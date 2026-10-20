import { Controller, Post, Body, UseGuards, Get, Param, Query, BadRequestException, Patch, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CustomerRewardService } from './customer-reward.service';
import { SearchRewardDto } from './dto/search-reward.dto';
import { CreateManualRewardDto } from './dto/create-manual-reward.dto';
import { ResetCustomerRewardDto } from './dto/reset-customer-reward.dto';
import { SearchRewardResetHistoryDto } from './dto/search-reward-reset-history.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/users.entity';

@Controller('customer-rewards')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomerRewardController {
  constructor(private readonly customerRewardService: CustomerRewardService) {}

  @Post('tracking')
  @RequirePermissions('sales:read')
  searchRewardTracking(@Body() searchDto: SearchRewardDto) {
    return this.customerRewardService.searchRewardTracking(searchDto);
  }

  @Patch('tracking/:customerId/threshold')
  @RequirePermissions('sales:manage')
  updateCustomerRewardThreshold(
    @Param('customerId') customerId: string,
    @Body('reward_threshold') rewardThreshold?: number | null,
  ) {
    return this.customerRewardService.updateCustomerRewardThreshold(
      +customerId,
      rewardThreshold,
    );
  }

  /** Xóa "Tích lũy hiện tại" của nhiều khách hàng (có lưu lịch sử để khôi phục) */
  @Post('tracking/reset')
  @RequirePermissions('sales:manage')
  resetCustomerAccumulation(
    @Body() resetDto: ResetCustomerRewardDto,
    @CurrentUser() user: User,
  ) {
    return this.customerRewardService.resetCustomerAccumulation(resetDto, user.id);
  }

  /** Danh sách lịch sử xóa tích lũy hiện tại */
  @Post('tracking/reset-history')
  @RequirePermissions('sales:read')
  searchRewardResetHistory(@Body() searchDto: SearchRewardResetHistoryDto) {
    return this.customerRewardService.searchRewardResetHistory(searchDto);
  }

  /** Khôi phục lại phần tích lũy đã xóa */
  @Post('tracking/reset-history/:id/restore')
  @RequirePermissions('sales:manage')
  restoreCustomerAccumulation(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.customerRewardService.restoreCustomerAccumulation(+id, user.id);
  }

  @Post('history')
  @RequirePermissions('sales:read')
  searchRewardHistory(@Body() searchDto: SearchRewardDto) {
    return this.customerRewardService.searchRewardHistory(searchDto);
  }

  @Get('preview/:debtNoteId')
  @RequirePermissions('sales:read')
  getRewardPreview(@Param('debtNoteId') debtNoteId: string, @Query('additional_amount') additionalAmount?: string) {
    return this.customerRewardService.getRewardPreviewById(+debtNoteId, additionalAmount ? +additionalAmount : 0);
  }

  @Get('preview-by-season')
  @RequirePermissions('sales:read')
  getRewardPreviewBySeason(
    @Query('customer_id') customerId: string,
    @Query('season_id') seasonId: string,
    @Query('additional_amount') additionalAmount?: string,
  ) {
    return this.customerRewardService.getRewardPreviewBySeason(+customerId, +seasonId, additionalAmount ? +additionalAmount : 0);
  }

  @Get('my-tracking')
  getMyRewardTracking(@CurrentUser() user: User) {
    if (!user.customer_id) {
      throw new BadRequestException('Tài khoản của bạn không liên kết với khách hàng nào');
    }
    return this.customerRewardService.getMyRewardTracking(user.customer_id);
  }

  @Get('my-history')
  getMyRewardHistory(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!user.customer_id) {
      throw new BadRequestException('Tài khoản của bạn không liên kết với khách hàng nào');
    }
    return this.customerRewardService.getMyRewardHistory(
      user.customer_id, 
      page ? +page : 1, 
      limit ? +limit : 10
    );
  }

  @Post()
  @RequirePermissions('sales:manage')
  manualCreate(
    @Body() createDto: CreateManualRewardDto,
    @CurrentUser() user: User
  ) {
    return this.customerRewardService.manualCreate(createDto, user.id);
  }

  @Patch('history/:id')
  @RequirePermissions('sales:manage')
  updateHistory(
    @Param('id') id: string,
    @Body() updateDto: CreateManualRewardDto,
    @CurrentUser() user: User
  ) {
    return this.customerRewardService.updateHistory(+id, updateDto, user.id);
  }

  @Delete('history/:id')
  @RequirePermissions('sales:manage')
  deleteHistory(@Param('id') id: string, @CurrentUser() user: User) {
    return this.customerRewardService.deleteHistory(+id, user.id);
  }
}
