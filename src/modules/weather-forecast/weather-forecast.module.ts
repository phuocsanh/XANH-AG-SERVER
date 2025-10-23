import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeatherForecastController } from './weather-forecast.controller';
import { WeatherForecastService } from './weather-forecast.service';
import { McpServerService } from '../ai-analysis-rice/mcp-server.service';
import { WebScrapingService } from './web-scraping.service';
import { WeatherForecast } from '../../entities/weather-forecast.entity';

/**
 * Module dự báo thời tiết
 * Cung cấp các API endpoint cho việc phân tích và dự báo thời tiết
 * Bao gồm: mưa bão, mực nước ĐBSCL, dự báo 10 ngày, và video YouTube
 */

@Module({
  imports: [TypeOrmModule.forFeature([WeatherForecast])],
  controllers: [WeatherForecastController],
  providers: [WeatherForecastService, McpServerService, WebScrapingService],
  exports: [WeatherForecastService],
})
export class WeatherForecastModule {}
