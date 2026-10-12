import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Controller cung cấp các API thống kê cho Dashboard admin
 */
@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Lấy tổng quan thống kê hệ thống
   * - Doanh thu, lợi nhuận, chi phí
   * - Công nợ phải thu (tổng, quá hạn, hoạt động)
   * - Tồn kho (số lượng, giá trị, sản phẩm hết, sắp hết hạn)
   */
  @Get('stats')
  @RequirePermissions('sales:read')
  async getStats(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getStats(query);
  }

  /**
   * Lấy dữ liệu doanh thu theo thời gian (có so sánh YoY)
   */
  @Get('revenue')
  @RequirePermissions('sales:read')
  async getRevenue(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getRevenue(query);
  }

  /**
   * Lấy dữ liệu công nợ phải thu (tổng, theo khách, aging)
   */
  @Get('receivables')
  @RequirePermissions('sales:read')
  async getReceivables(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getReceivables(query);
  }

  /**
   * Lấy dữ liệu tồn kho (tổng giá trị, sản phẩm sắp hết, hết hạn, thấp tồn)
   */
  @Get('inventory')
  @RequirePermissions('inventory:read')
  async getInventory(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getInventory(query);
  }

  /**
   * Lấy top sản phẩm bán chạm
   */
  @Get('sales-performance/top-products')
  @RequirePermissions('sales:read')
  async getTopProducts(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getSalesPerformance(query, 'top-products');
  }

  /**
   * Lấy top khách hàng mua nhiều nhất
   */
  @Get('sales-performance/top-customers')
  @RequirePermissions('sales:read')
  async getTopCustomers(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getSalesPerformance(query, 'top-customers');
  }

  /**
   * Lấy top nhân viên bán hàng xuất sắc
   */
  @Get('sales-performance/top-employees')
  @RequirePermissions('sales:read')
  async getTopEmployees(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getSalesPerformance(query, 'top-employees');
  }
}
