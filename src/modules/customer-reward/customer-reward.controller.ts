import { Controller, Post, Body, UseGuards, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CustomerRewardService } from './customer-reward.service';
import { SearchRewardDto } from './dto/search-reward.dto';
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
  getRewardPreview(@Param('debtNoteId') debtNoteId: string) {
    return this.customerRewardService.getRewardPreviewById(+debtNoteId);
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
  @RequirePermissions('sales:create')
  manualCreate(
    @Body() createDto: any,
    @CurrentUser() user: User
  ) {
    return this.customerRewardService.manualCreate(createDto, user.id);
  }
}
