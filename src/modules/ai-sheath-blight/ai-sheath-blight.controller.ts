import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiSheathBlightService } from './ai-sheath-blight.service';
import { SheathBlightWarning } from '../../entities/sheath-blight-warning.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('AI Sheath Blight Warning')
@Controller('ai-sheath-blight')
@UseGuards(JwtAuthGuard)
export class AiSheathBlightController {
  constructor(private readonly service: AiSheathBlightService) {}

  @Get('warning')
  @ApiOperation({ summary: 'Lấy cảnh báo Khô Vằn mới nhất' })
  @ApiResponse({ status: 200, type: SheathBlightWarning })
  getWarning() {
    return this.service.getWarning();
  }

  @Post('run-now')
  @ApiOperation({ summary: 'Chạy phân tích Khô Vằn ngay lập tức' })
  runAnalysis() {
    return this.service.runAnalysis();
  }
}
