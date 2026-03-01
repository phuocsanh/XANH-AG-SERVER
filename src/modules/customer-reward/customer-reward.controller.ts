import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CustomerRewardService } from './customer-reward.service';
import { SearchRewardDto } from './dto/search-reward.dto';

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
}
