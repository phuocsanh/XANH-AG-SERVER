import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ExpiryAlertService } from './expiry-alert.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('expiry-alert')
@UseGuards(JwtAuthGuard)
export class ExpiryAlertController {
  constructor(private readonly expiryAlertService: ExpiryAlertService) {}

  @Post('check')
  @RequirePermissions('inventory:manage')
  async manualCheck() {
    return this.expiryAlertService.checkAndCreateAlerts();
  }

  @Get('history')
  @RequirePermissions('inventory:read')
  async getHistory(@Query() filters: any) {
    return this.expiryAlertService.getAlertHistory(filters);
  }

  @Get('product/:productId/batches')
  @RequirePermissions('inventory:read')
  async getBatchesByProduct(@Param('productId') productId: string) {
    return this.expiryAlertService.getBatchesByProduct(Number(productId));
  }

  @Patch(':id/resolve')
  @RequirePermissions('inventory:manage')
  async resolveAlert(
    @Param('id') id: string,
    @Body('notes') notes: string,
  ) {
    return this.expiryAlertService.resolveAlert(Number(id), notes);
  }
}
