import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiGallMidgeService } from './ai-gall-midge.service';
import { GallMidgeWarning } from '../../entities/gall-midge-warning.entity';

@ApiTags('AI Gall Midge Warning')
@Controller('ai-gall-midge')
export class AiGallMidgeController {
  constructor(private readonly service: AiGallMidgeService) {}

  @Get('warning')
  @ApiOperation({ summary: 'Lấy cảnh báo Muỗi Hành mới nhất' })
  @ApiResponse({ status: 200, type: GallMidgeWarning })
  getWarning() {
    return this.service.getWarning();
  }

  @Post('run-now')
  @ApiOperation({ summary: 'Chạy phân tích Muỗi Hành ngay lập tức' })
  runAnalysis() {
    return this.service.runAnalysis();
  }
}
