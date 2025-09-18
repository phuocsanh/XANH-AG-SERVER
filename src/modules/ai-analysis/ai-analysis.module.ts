import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiAnalysisController } from './ai-analysis.controller';
import { AiAnalysisService } from './ai-analysis.service';
import { WebSearchService } from './web-search.service';

/**
 * Module quản lý chức năng phân tích AI thị trường lúa gạo
 * Tích hợp Google Generative AI với web search để có thông tin real-time
 */
@Module({
  imports: [
    // Import ConfigModule để sử dụng environment variables
    ConfigModule
  ],
  controllers: [AiAnalysisController],
  providers: [AiAnalysisService, WebSearchService],
  exports: [AiAnalysisService, WebSearchService] // Export services để có thể sử dụng ở module khác nếu cần
})
export class AiAnalysisModule {}