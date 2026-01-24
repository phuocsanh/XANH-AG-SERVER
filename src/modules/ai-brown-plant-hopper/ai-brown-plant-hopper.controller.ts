import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiBrownPlantHopperService } from './ai-brown-plant-hopper.service';
import { BrownPlantHopperWarning } from '../../entities/brown-plant-hopper-warning.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('AI Brown Plant Hopper Warning')
@Controller('ai-brown-plant-hopper')
@UseGuards(JwtAuthGuard)
export class AiBrownPlantHopperController {
  constructor(private readonly service: AiBrownPlantHopperService) {}

  @Get('warning')
  @ApiOperation({ summary: 'Lấy cảnh báo Rầy Nâu mới nhất' })
  @ApiResponse({ status: 200, type: BrownPlantHopperWarning })
  getWarning() {
    return this.service.getWarning();
  }

  @Post('run-now')
  @ApiOperation({ summary: 'Chạy phân tích Rầy Nâu ngay lập tức' })
  runAnalysis() {
    return this.service.runAnalysis();
  }
}
