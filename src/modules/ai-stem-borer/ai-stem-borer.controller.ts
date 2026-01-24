import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiStemBorerService } from './ai-stem-borer.service';
import { StemBorerWarning } from '../../entities/stem-borer-warning.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('AI Stem Borer Warning')
@Controller('ai-stem-borer')
@UseGuards(JwtAuthGuard)
export class AiStemBorerController {
  constructor(private readonly service: AiStemBorerService) {}

  @Get('warning')
  @ApiOperation({ summary: 'Lấy cảnh báo Sâu Đục Thân mới nhất' })
  @ApiResponse({ status: 200, type: StemBorerWarning })
  getWarning() {
    return this.service.getWarning();
  }

  @Post('run-now')
  @ApiOperation({ summary: 'Chạy phân tích Sâu Đục Thân ngay lập tức' })
  runAnalysis() {
    return this.service.runAnalysis();
  }
}
