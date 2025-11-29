import { Controller, Get, Post, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiBacterialBlightService } from './ai-bacterial-blight.service';
import { BacterialBlightWarning } from '../../entities/bacterial-blight-warning.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Controller xử lý các API endpoint cho cảnh báo bệnh cháy bìa lá
 */
@ApiTags('Bacterial Blight Warning')
@Controller('ai-bacterial-blight')
export class AiBacterialBlightController {
  private readonly logger = new Logger(AiBacterialBlightController.name);

  constructor(private readonly aiBacterialBlightService: AiBacterialBlightService) {}

  /**
   * GET /ai-bacterial-blight/warning
   * Lấy cảnh báo bệnh cháy bìa lá mới nhất
   */
  @Get('warning')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('RICE_BLAST_VIEW')
  @ApiOperation({ summary: 'Lấy cảnh báo bệnh cháy bìa lá mới nhất' })
  @ApiResponse({ 
    status: 200, 
    description: 'Thành công', 
    type: BacterialBlightWarning 
  })
  async getWarning(): Promise<BacterialBlightWarning> {
    this.logger.log('GET /ai-bacterial-blight/warning');
    return this.aiBacterialBlightService.getWarning();
  }

  /**
   * POST /ai-bacterial-blight/run-now
   * Chạy phân tích bệnh cháy bìa lá ngay lập tức
   */
  @Post('run-now')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('RICE_BLAST_MANAGE')
  @ApiOperation({ summary: 'Chạy phân tích bệnh cháy bìa lá ngay lập tức' })
  @ApiResponse({ 
    status: 200, 
    description: 'Phân tích thành công', 
    type: BacterialBlightWarning 
  })
  async runAnalysisNow(): Promise<BacterialBlightWarning> {
    this.logger.log('POST /ai-bacterial-blight/run-now - Manual trigger');
    return this.aiBacterialBlightService.runAnalysis();
  }
}
