import { Controller, Get, Param, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StoreProfitReportService } from './store-profit-report.service';
import { InvoiceProfitDto } from './dto/invoice-profit.dto';
import { SeasonStoreProfitDto } from './dto/season-store-profit.dto';
import { CustomerProfitReportDto } from './dto/customer-profit-report.dto';
import { PeriodReportDto } from './dto/period-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Controller xử lý API cho báo cáo lợi nhuận cửa hàng
 */
@ApiTags('Store Profit Report')
@ApiBearerAuth()
@Controller('store-profit-report')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StoreProfitReportController {
  constructor(private readonly service: StoreProfitReportService) {}

  @Get('invoice/code/:code')
  @RequirePermissions('store_profit_report:read')
  @ApiOperation({ 
    summary: 'Xem lợi nhuận chi tiết của 1 đơn hàng qua mã (code)',
    description: 'Trả về thông tin lợi nhuận gộp và chi tiết từng sản phẩm trong đơn hàng'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Thông tin lợi nhuận đơn hàng',
    type: InvoiceProfitDto 
  })
  async getInvoiceProfitByCode(
    @Param('code') code: string,
  ): Promise<InvoiceProfitDto> {
    return this.service.calculateInvoiceProfitByCode(code);
  }

  @Get('invoice/:id')
  @RequirePermissions('store_profit_report:read')
  @ApiOperation({ 
    summary: 'Xem lợi nhuận chi tiết của 1 đơn hàng',
    description: 'Trả về thông tin lợi nhuận gộp và chi tiết từng sản phẩm trong đơn hàng'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Thông tin lợi nhuận đơn hàng',
    type: InvoiceProfitDto 
  })
  async getInvoiceProfit(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<InvoiceProfitDto> {
    return this.service.calculateInvoiceProfit(id);
  }

  @Get('season/:seasonId')
  @RequirePermissions('store_profit_report:read')
  @ApiOperation({
    summary: 'Báo cáo lợi nhuận tổng hợp theo mùa vụ',
    description: 'Bao gồm: Doanh thu, Giá vốn, Chi phí vận hành, Lợi nhuận ròng, Top customers, Top products'
  })
  @ApiResponse({
    status: 200,
    description: 'Báo cáo lợi nhuận mùa vụ',
    type: SeasonStoreProfitDto,
  })
  async getSeasonReport(
    @Param('seasonId', ParseIntPipe) seasonId: number,
  ): Promise<SeasonStoreProfitDto> {
    return this.service.getSeasonStoreProfitReport(seasonId);
  }

  @Get('customer/:customerId')
  @RequirePermissions('store_profit_report:read')
  @ApiOperation({
    summary: 'Báo cáo lợi nhuận theo khách hàng',
    description: 'Xem lịch sử lợi nhuận từ các đơn hàng của một khách hàng cụ thể'
  })
  @ApiQuery({ name: 'seasonId', required: false, type: Number, description: 'Lọc theo mùa vụ' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Lọc từ ngày (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Lọc đến ngày (YYYY-MM-DD)' })
  @ApiResponse({
    status: 200,
    description: 'Báo cáo lợi nhuận khách hàng',
    type: CustomerProfitReportDto,
  })
  async getCustomerReport(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('customerName') customerName?: string,
    @Query('seasonId') seasonId?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<CustomerProfitReportDto> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const season = seasonId ? Number(seasonId) : undefined;
    
    return this.service.getCustomerProfitReport(customerId, customerName, season, start, end);
  }

  @Get('rice-crop/:riceCropId')
  @RequirePermissions('store_profit_report:read')
  @ApiOperation({
    summary: 'Báo cáo lợi nhuận theo vụ lúa',
    description: 'Xem lợi nhuận từ các đơn hàng liên quan đến một vụ lúa cụ thể'
  })
  @ApiResponse({
    status: 200,
    description: 'Báo cáo lợi nhuận vụ lúa',
  })
  async getRiceCropReport(
    @Param('riceCropId', ParseIntPipe) riceCropId: number,
  ): Promise<any> {
    return this.service.getRiceCropProfitReport(riceCropId);
  }

  @Get('period')
  @RequirePermissions('store_profit_report:read')
  @ApiOperation({
    summary: 'Báo cáo doanh thu và lợi nhuận theo khoảng thời gian',
    description: 'Thống kê doanh thu (tất cả, có hóa đơn, không hóa đơn) và lợi nhuận ròng'
  })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Từ ngày (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'Đến ngày (YYYY-MM-DD)' })
  @ApiResponse({
    status: 200,
    description: 'Báo cáo doanh thu theo kỳ',
    type: PeriodReportDto,
  })
  async getPeriodReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('taxableFilter') taxableFilter: 'all' | 'yes' | 'no' = 'all',
    @Query('onlyRecentTaxedProducts') filterByReceiptDate?: string,
  ): Promise<PeriodReportDto> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Đặt giờ cuối ngày cho endDate để bao gồm cả ngày đó
    end.setHours(23, 59, 59, 999);
    
    return this.service.getPeriodProfitReport(start, end, taxableFilter, filterByReceiptDate);
  }
}
