import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAnalysisService } from './ai-analysis.service';
import { AiAnalysisController } from './ai-analysis.controller';
import { McpServerService } from './mcp-server.service';
import { RiceMarketData } from '../../entities/rice-market.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RiceMarketData])],
  controllers: [AiAnalysisController],
  providers: [AiAnalysisService, McpServerService],
  exports: [AiAnalysisService, McpServerService],
})
export class AiAnalysisModule {}
