import { ApiProperty } from '@nestjs/swagger';
import {
  WeatherForecastResult,
  YouTubeVideoData,
} from '../interfaces/weather-forecast.interface';

/**
 * DTO cho response dự báo thời tiết
 */
export class WeatherResponseDto implements WeatherForecastResult {
  @ApiProperty({
    description: 'Tóm tắt tình hình thời tiết hiện tại',
    example:
      'Trong 10 ngày tới, khu vực ĐBSCL có mưa rào và dông nhiều nơi, nguy cơ có bão ảnh hưởng',
  })
  summary: string;

  @ApiProperty({
    description: 'Thông tin về mưa bão dạng text tóm tắt',
  })
  hydrologyInfo: string;

  @ApiProperty({
    description: 'Thông tin mực nước Đồng bằng sông Cửu Long',
  })
  waterLevelInfo: string;

  @ApiProperty({
    description: 'Dự báo bão, áp thấp nhiệt đới',
  })
  stormsAndTropicalDepressionsInfo: string;

  @ApiProperty({
    description: 'Danh sách video YouTube về dự báo thời tiết',
    type: [Object],
  })
  youtubeVideos: YouTubeVideoData[];

  @ApiProperty({
    description: 'Thời gian cập nhật',
    example: '2024-01-15T10:30:00.000Z',
  })
  lastUpdated: string;

  @ApiProperty({
    description: 'Danh sách nguồn dữ liệu',
    type: [String],
    example: [
      'Trung tâm Dự báo Khí tượng Thủy văn Quốc gia',
      'Weather.com',
      'YouTube',
    ],
  })
  dataSources: string[];

  @ApiProperty({
    description: 'Chất lượng dữ liệu',
  })
  dataQuality: {
    reliability: 'high' | 'medium' | 'low';
    sourcesUsed: number;
    score: number;
  };

  constructor() {
    // Khởi tạo giá trị mặc định để tránh lỗi TypeScript
    this.summary = '';
    this.hydrologyInfo = '';
    this.waterLevelInfo = '';
    this.stormsAndTropicalDepressionsInfo = '';
    this.youtubeVideos = [];
    this.lastUpdated = new Date().toISOString();
    this.dataSources = [];
    this.dataQuality = { reliability: 'low', sourcesUsed: 0, score: 0 };
  }
}
