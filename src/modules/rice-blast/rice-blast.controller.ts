import { Controller, Get, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RiceBlastService } from './rice-blast.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { Location } from '../../entities/location.entity';
import { RiceBlastWarning } from '../../entities/rice-blast-warning.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Controller xử lý các API endpoint cho cảnh báo bệnh đạo ôn
 */
@ApiTags('Rice Blast Warning')
@Controller('api')
export class RiceBlastController {
  private readonly logger = new Logger(RiceBlastController.name);

  constructor(private readonly riceBlastService: RiceBlastService) {}

  /**
   * GET /api/location
   * Lấy vị trí ruộng lúa hiện tại
   * Public - Mọi user đã đăng nhập đều xem được
   */
  @Get('location')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('RICE_BLAST_VIEW')
  @ApiOperation({ summary: 'Lấy vị trí ruộng lúa hiện tại' })
  @ApiResponse({ 
    status: 200, 
    description: 'Thành công', 
    type: Location 
  })
  async getLocation(): Promise<Location> {
    this.logger.log('GET /api/location');
    return this.riceBlastService.getLocation();
  }

  /**
   * POST /api/location
   * Cập nhật vị trí ruộng lúa (UPSERT id = 1)
   * Chỉ Admin/Super Admin
   */
  @Post('location')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('RICE_BLAST_MANAGE')
  @ApiOperation({ summary: 'Cập nhật vị trí ruộng lúa' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cập nhật thành công', 
    type: Location 
  })
  async updateLocation(@Body() dto: UpdateLocationDto): Promise<Location> {
    this.logger.log(`POST /api/location - ${dto.name}`);
    return this.riceBlastService.updateLocation(dto);
  }

  /**
   * GET /api/warning
   * Lấy cảnh báo bệnh đạo ôn mới nhất
   * Public - Mọi user đã đăng nhập đều xem được
   */
  @Get('warning')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('RICE_BLAST_VIEW')
  @ApiOperation({ summary: 'Lấy cảnh báo bệnh đạo ôn mới nhất' })
  @ApiResponse({ 
    status: 200, 
    description: 'Thành công', 
    type: RiceBlastWarning 
  })
  async getWarning(): Promise<RiceBlastWarning> {
    this.logger.log('GET /api/warning');
    return this.riceBlastService.getWarning();
  }

  /**
   * POST /api/run-now
   * Chạy phân tích bệnh đạo ôn ngay lập tức (manual trigger)
   * Chỉ Admin/Super Admin
   */
  @Post('run-now')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('RICE_BLAST_MANAGE')
  @ApiOperation({ summary: 'Chạy phân tích bệnh đạo ôn ngay lập tức' })
  @ApiResponse({ 
    status: 200, 
    description: 'Phân tích thành công', 
    type: RiceBlastWarning 
  })
  async runAnalysisNow(): Promise<RiceBlastWarning> {
    this.logger.log('POST /api/run-now - Manual trigger');
    return this.riceBlastService.runAnalysis();
  }
}
