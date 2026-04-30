import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { User } from '../../entities/users.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePromotionCampaignDto } from './dto/create-promotion-campaign.dto';
import { SearchPromotionRewardReservationDto } from './dto/search-promotion-reward-reservation.dto';
import { SearchPromotionCampaignDto } from './dto/search-promotion-campaign.dto';
import { UpdatePromotionCampaignStatusDto } from './dto/update-promotion-campaign-status.dto';
import { UpdatePromotionCampaignDto } from './dto/update-promotion-campaign.dto';
import { PromotionCampaignService } from './promotion-campaign.service';

@Controller('promotion-campaigns')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PromotionCampaignController {
  constructor(
    private readonly promotionCampaignService: PromotionCampaignService,
  ) {}

  @Post()
  @RequirePermissions('sales:manage')
  create(
    @Body() dto: CreatePromotionCampaignDto,
    @CurrentUser() user: User,
  ) {
    return this.promotionCampaignService.create(dto, user.id);
  }

  @Get()
  @RequirePermissions('sales:read')
  findAll(@Query() query: SearchPromotionCampaignDto) {
    return this.promotionCampaignService.findAll(query);
  }

  @Get('my-progress')
  getMyProgress(@CurrentUser() user: User) {
    if (!user.customer_id) {
      throw new BadRequestException(
        'Tài khoản của bạn không liên kết với khách hàng nào',
      );
    }

    return this.promotionCampaignService.getMyProgress(user.customer_id);
  }

  @Get('reward-reservations')
  @RequirePermissions('sales:read')
  listAllRewardReservations(
    @Query() query: SearchPromotionRewardReservationDto,
  ) {
    return this.promotionCampaignService.listAllReservations(query);
  }

  @Get(':id/my-spins')
  getMySpinLogs(@Param('id') id: string, @CurrentUser() user: User) {
    if (!user.customer_id) {
      throw new BadRequestException(
        'Tài khoản của bạn không liên kết với khách hàng nào',
      );
    }

    return this.promotionCampaignService.getMySpinLogs(+id, user.customer_id);
  }

  @Post(':id/spin')
  spin(@Param('id') id: string, @CurrentUser() user: User) {
    if (!user.customer_id) {
      throw new BadRequestException(
        'Tài khoản của bạn không liên kết với khách hàng nào',
      );
    }

    return this.promotionCampaignService.spin(+id, user.customer_id);
  }

  @Get(':id')
  @RequirePermissions('sales:read')
  findOne(@Param('id') id: string) {
    return this.promotionCampaignService.findOne(+id);
  }

  @Get(':id/reservations')
  @RequirePermissions('sales:read')
  listReservations(@Param('id') id: string) {
    return this.promotionCampaignService.listReservations(+id);
  }

  @Patch(':id/reservations/:reservationId/issue')
  @RequirePermissions('sales:manage')
  issueReservation(
    @Param('id') id: string,
    @Param('reservationId') reservationId: string,
    @CurrentUser() user: User,
  ) {
    return this.promotionCampaignService.issueReservation(
      +id,
      +reservationId,
      user.id,
    );
  }

  @Patch(':id')
  @RequirePermissions('sales:manage')
  update(@Param('id') id: string, @Body() dto: UpdatePromotionCampaignDto) {
    return this.promotionCampaignService.update(+id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('sales:manage')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionCampaignStatusDto,
  ) {
    return this.promotionCampaignService.updateStatus(+id, dto.status as any);
  }
}
