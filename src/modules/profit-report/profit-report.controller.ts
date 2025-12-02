import { Controller, Get, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfitReportService } from './profit-report.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Profit Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('profit-reports')
export class ProfitReportController {
  constructor(private readonly profitReportService: ProfitReportService) {}

  @Get('crop/:cropId')
  @RequirePermissions('rice_crop:read')
  @ApiOperation({ summary: 'Báo cáo lợi nhuận vụ lúa' })
  getCropProfitability(@Param('cropId', ParseIntPipe) cropId: number) {
    return this.profitReportService.calculateCropProfitability(cropId);
  }

  @Get('season/:seasonId')
  @RequirePermissions('rice_crop:read')
  @ApiOperation({ summary: 'Báo cáo lợi nhuận mùa vụ' })
  getSeasonReport(
    @Param('seasonId', ParseIntPipe) seasonId: number,
    @Query('customerId', ParseIntPipe) customerId?: number,
  ) {
    return this.profitReportService.getSeasonProfitReport(seasonId, customerId);
  }
}
