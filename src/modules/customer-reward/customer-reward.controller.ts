import { Controller, Post, Body, UseGuards, Get, Param, Query, BadRequestException, Patch, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CustomerRewardService } from './customer-reward.service';
import { SearchRewardDto } from './dto/search-reward.dto';
import { CreateManualRewardDto } from './dto/create-manual-reward.dto';
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
  deleteHistory(@Param('id') id: string) {
    return this.customerRewardService.deleteHistory(+id);
  }
}
