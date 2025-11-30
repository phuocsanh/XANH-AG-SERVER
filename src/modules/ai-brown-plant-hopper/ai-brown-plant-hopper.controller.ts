import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiBrownPlantHopperService } from './ai-brown-plant-hopper.service';
import { BrownPlantHopperWarning } from '../../entities/brown-plant-hopper-warning.entity';

@ApiTags('AI Brown Plant Hopper Warning')
@Controller('ai-brown-plant-hopper')
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
