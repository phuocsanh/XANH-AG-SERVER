import { Controller, Get, Post, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiPestWarningService } from './ai-pest-warning.service';
import { PestWarning } from '../../entities/pest-warning.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Pest Warning')
@Controller('ai-pest-warning')
export class AiPestWarningController {
  private readonly logger = new Logger(AiPestWarningController.name);

  constructor(private readonly aiPestWarningService: AiPestWarningService) {}

  @Get('warning')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('RICE_BLAST_VIEW') // Tạm dùng quyền này hoặc tạo quyền mới PEST_WARNING_VIEW
  @ApiOperation({ summary: 'Lấy cảnh báo sâu hại mới nhất' })
  @ApiResponse({ status: 200, type: PestWarning })
  async getWarning(): Promise<PestWarning> {
    return this.aiPestWarningService.getWarning();
  }

  @Post('run-now')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('RICE_BLAST_MANAGE') // Tạm dùng quyền này
  @ApiOperation({ summary: 'Chạy phân tích sâu hại ngay lập tức' })
  @ApiResponse({ status: 200, type: PestWarning })
  async runAnalysisNow(): Promise<PestWarning> {
    return this.aiPestWarningService.runAnalysis();
  }
}
