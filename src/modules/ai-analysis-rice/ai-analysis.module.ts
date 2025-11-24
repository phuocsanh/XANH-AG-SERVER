import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAnalysisService } from './ai-analysis.service';
import { AiAnalysisController } from './ai-analysis.controller';
import { McpServerService } from './mcp-server.service';
import { RiceMarketData } from '../../entities/rice-market.entity';

/**
 * AiAnalysisModule - Module phân tích AI thị trường lúa gạo
 * 
 * Module này cung cấp các chức năng:
 * - Phân tích thị trường lúa gạo bằng AI
 * - Dự đoán giá lúa gạo
 * - Lưu trữ và quản lý dữ liệu thị trường
 * - Tích hợp MCP Server để xử lý dữ liệu
 */
@Module({
  imports: [TypeOrmModule.forFeature([RiceMarketData])],
  controllers: [AiAnalysisController],
  providers: [AiAnalysisService, McpServerService],
  exports: [AiAnalysisService, McpServerService],
})
export class AiAnalysisModule {}
