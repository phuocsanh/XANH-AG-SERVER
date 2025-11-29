import { Controller, Get, Post, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiRiceBlastService } from './ai-rice-blast.service';
import { RiceBlastWarning } from '../../entities/rice-blast-warning.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Controller xử lý các API endpoint cho cảnh báo bệnh đạo ôn
 */
@ApiTags('Rice Blast Warning')
@Controller('ai-rice-blast')
export class AiRiceBlastController {
  private readonly logger = new Logger(AiRiceBlastController.name);

  constructor(private readonly aiRiceBlastService: AiRiceBlastService) {}

  /**
   * GET /ai-rice-blast/warning
   * Lấy cảnh báo bệnh đạo ôn mới nhất
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
    this.logger.log('GET /ai-rice-blast/warning');
    return this.aiRiceBlastService.getWarning();
  }

  /**
   * POST /ai-rice-blast/run-now
   * Chạy phân tích bệnh đạo ôn ngay lập tức
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
    this.logger.log('POST /ai-rice-blast/run-now - Manual trigger');
    return this.aiRiceBlastService.runAnalysis();
  }
}
