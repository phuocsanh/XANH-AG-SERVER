import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SupplierReportService } from './supplier-report.service';
import { SupplierReportDto } from './dto/supplier-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Supplier Report')
@ApiBearerAuth()
@Controller('supplier-report')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SupplierReportController {
  constructor(private readonly supplierReportService: SupplierReportService) {}

  @Get('stats/:id')
  @RequirePermissions('inventory:read')
  @ApiOperation({ 
    summary: 'Lấy thống kê doanh số và lợi nhuận của một nhà cung cấp',
    description: 'Tính toán tổng doanh thu, giá vốn và lợi nhuận dựa trên các sản phẩm đã nhập từ nhà cung cấp này'
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Thống kê nhà cung cấp',
    type: SupplierReportDto 
  })
  async getSupplierStats(
    @Param('id', ParseIntPipe) id: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<SupplierReportDto> {
    return this.supplierReportService.getSupplierSalesStats(id, startDate, endDate);
  }
}
