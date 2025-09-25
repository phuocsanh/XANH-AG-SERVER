import { Module } from '@nestjs/common';
import { AiAnalysisService } from './ai-analysis.service';
import { AiAnalysisController } from './ai-analysis.controller';
import { McpServerService } from './mcp-server.service';

@Module({
  controllers: [AiAnalysisController],
  providers: [AiAnalysisService, McpServerService],
  exports: [AiAnalysisService, McpServerService],
})
export class AiAnalysisModule {}