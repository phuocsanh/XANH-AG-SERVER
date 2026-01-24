import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiGrainDiscolorationService } from './ai-grain-discoloration.service';
import { GrainDiscolorationWarning } from '../../entities/grain-discoloration-warning.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('AI Grain Discoloration Warning')
@Controller('ai-grain-discoloration')
@UseGuards(JwtAuthGuard)
export class AiGrainDiscolorationController {
  constructor(private readonly service: AiGrainDiscolorationService) {}

  @Get('warning')
  @ApiOperation({ summary: 'Lấy cảnh báo Lem Lép Hạt mới nhất' })
  @ApiResponse({ status: 200, type: GrainDiscolorationWarning })
  getWarning() {
    return this.service.getWarning();
  }

  @Post('run-now')
  @ApiOperation({ summary: 'Chạy phân tích Lem Lép Hạt ngay lập tức' })
  runAnalysis() {
    return this.service.runAnalysis();
  }
}
