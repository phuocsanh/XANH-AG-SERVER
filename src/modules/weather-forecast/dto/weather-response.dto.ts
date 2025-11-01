import { ApiProperty } from '@nestjs/swagger';

export interface YouTubeVideoData {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
}

export class WeatherResponseDto {
  @ApiProperty({
    description: 'Tóm tắt dự báo thời tiết dạng text',
    example: 'Thời tiết miền Bắc hôm nay có mưa rào vào chiều tối...',
  })
  summary: string;

  @ApiProperty({
    description: 'Thông tin về mưa bão dạng text tóm tắt',
  })
  hydrology_info: string;

  @ApiProperty({
    description: 'Thông tin mực nước Đồng bằng sông Cửu Long',
  })
  water_level_info: string;

  @ApiProperty({
    description: 'Dự báo bão, áp thấp nhiệt đới',
  })
  storms_and_tropical_depressions_info: string;

  @ApiProperty({
    description: 'Danh sách video YouTube về dự báo thời tiết',
    type: [Object],
  })
  youtube_videos: YouTubeVideoData[];

  @ApiProperty({
    description: 'Thời gian cập nhật',
    example: '2024-01-15T10:30:00.000Z',
  })
  last_updated: string;

  @ApiProperty({
    description: 'Danh sách nguồn dữ liệu',
    type: [String],
    example: [
      'Trung tâm Dự báo Khí tượng Thủy văn Quốc gia',
      'Weather.com',
      'YouTube',
    ],
  })
  data_sources: string[];

  @ApiProperty({
    description: 'Chất lượng dữ liệu',
  })
  data_quality: {
    reliability: 'high' | 'medium' | 'low';
    sourcesUsed: number;
    score: number;
  };

  constructor() {
    // Khởi tạo giá trị mặc định để tránh lỗi TypeScript
    this.summary = '';
    this.hydrology_info = '';
    this.water_level_info = '';
    this.storms_and_tropical_depressions_info = '';
    this.youtube_videos = [];
    this.last_updated = new Date().toISOString();
    this.data_sources = [];
    this.data_quality = { reliability: 'low', sourcesUsed: 0, score: 0 };
  }
}
