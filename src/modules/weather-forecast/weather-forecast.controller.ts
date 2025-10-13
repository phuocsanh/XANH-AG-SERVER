import {
  Controller,
  Get,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WeatherForecastService } from './weather-forecast.service';
import { WeatherResponseDto } from './dto/weather-response.dto';
import { WeatherForecastResult } from './interfaces/weather-forecast.interface';

/**
 * Controller xử lý các API endpoint liên quan đến dự báo thời tiết
 * Bao gồm phân tích mưa bão, mực nước ĐBSCL, và dự báo 10 ngày
 */
@ApiTags('Weather Forecast')
@Controller('weather-forecast')
export class WeatherForecastController {
  private readonly logger = new Logger(WeatherForecastController.name);

  constructor(
    private readonly weatherForecastService: WeatherForecastService,
  ) {}

  /**
   * Endpoint lấy dự báo thời tiết tổng hợp
   * Phân tích mưa bão, mực nước ĐBSCL, và dự báo 10 ngày
   */
  @Get('full-forecast')
  @ApiOperation({
    summary: 'Dự báo thời tiết tổng hợp',
    description:
      'Phân tích tình hình mưa bão, mực nước Đồng bằng sông Cửu Long, và dự báo thời tiết 10 ngày tới',
  })
  @ApiResponse({
    status: 200,
    description: 'Phân tích thành công',
    type: WeatherResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Lỗi server khi phân tích',
  })
  async getFullWeatherForecast(): Promise<WeatherForecastResult> {
    try {
      this.logger.log('Nhận yêu cầu dự báo thời tiết tổng hợp');

      // Gọi service để phân tích thời tiết
      const result = await this.weatherForecastService.analyzeWeatherForecast();

      this.logger.log('Trả về kết quả dự báo thời tiết thành công');
      return result;
    } catch (error: any) {
      this.logger.error('Lỗi trong controller khi phân tích thời tiết:', error);

      throw new HttpException(
        {
          message: 'Không thể phân tích dự báo thời tiết',
          error: error.message || 'Lỗi không xác định',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          timestamp: new Date().toISOString(),
          path: '/weather-forecast/full-forecast',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Endpoint kiểm tra trạng thái service
   */
  @Get('health')
  @ApiOperation({
    summary: 'Kiểm tra trạng thái Weather service',
    description:
      'Endpoint để kiểm tra xem Weather Forecast service có hoạt động bình thường không',
  })
  @ApiResponse({
    status: 200,
    description: 'Service hoạt động bình thường',
  })
  async checkHealth() {
    this.logger.log('Kiểm tra trạng thái Weather Forecast service');

    return {
      status: 'healthy',
      service: 'Weather Forecast Service',
      timestamp: new Date().toISOString(),
      message: 'Service đang hoạt động bình thường',
    };
  }
}
