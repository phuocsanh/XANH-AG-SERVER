import {
  Controller,
  Get,
  Logger,
  HttpException,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { WeatherForecastService } from './weather-forecast.service';
import { WeatherResponseDto } from './dto/weather-response.dto';
import {
  WeatherForecastResult,
  YouTubeVideoData,
  YouTubeSearchResult,
} from './interfaces/weather-forecast.interface';
import { WeatherForecast } from '../../entities/weather-forecast.entity';

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
   * Endpoint lấy dữ liệu thời tiết mới nhất từ database
   */
  @Get('climate-forecasting')
  @ApiOperation({
    summary: 'Lấy dữ liệu thời tiết mới nhất',
    description:
      'Trả về dữ liệu thời tiết mới nhất đã được lưu trữ trong database',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy dữ liệu thành công',
    type: WeatherForecast,
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy dữ liệu',
  })
  async getLatestWeatherForecast(): Promise<WeatherForecast> {
    try {
      this.logger.log('Nhận yêu cầu lấy dữ liệu thời tiết mới nhất');

      // Gọi service để lấy dữ liệu mới nhất từ database
      const result = await this.weatherForecastService.getLatestForecast();

      if (!result) {
        throw new HttpException(
          {
            message: 'Không tìm thấy dữ liệu thời tiết',
            statusCode: HttpStatus.NOT_FOUND,
            timestamp: new Date().toISOString(),
            path: '/weather-forecast/latest',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log('Trả về dữ liệu thời tiết mới nhất thành công');
      return result;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        'Lỗi trong controller khi lấy dữ liệu thời tiết:',
        error,
      );

      throw new HttpException(
        {
          message: 'Không thể lấy dữ liệu thời tiết mới nhất',
          error: error.message || 'Lỗi không xác định',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date().toISOString(),
          path: '/weather-forecast/latest',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Endpoint lấy danh sách video YouTube về dự báo thời tiết
   * @param query - Từ khóa tìm kiếm (mặc định: "dự báo thời tiết Việt Nam")
   * @param limit - Số lượng video tối đa (mặc định: 5)
   * @returns Promise<YouTubeSearchResult> - Kết quả tìm kiếm YouTube
   */
  @Get('youtube-videos')
  @ApiOperation({
    summary: 'Lấy video YouTube về dự báo thời tiết',
    description:
      'Tìm kiếm và lấy danh sách video YouTube mới nhất về dự báo thời tiết',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Từ khóa tìm kiếm (mặc định: "dự báo thời tiết Việt Nam")',
    example: 'dự báo thời tiết Việt Nam',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Số lượng video tối đa (mặc định: 5)',
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách video thành công',
  })
  @ApiResponse({
    status: 500,
    description: 'Lỗi server khi tìm kiếm video',
  })
  async getYouTubeVideos(
    @Query('query') query?: string,
    @Query('limit') limit?: number,
  ): Promise<YouTubeSearchResult> {
    try {
      this.logger.log(
        `Nhận yêu cầu lấy YouTube videos với query: "${query || 'dự báo thời tiết Việt Nam'}", limit: ${limit || 5}`,
      );

      // Gọi service để lấy video YouTube
      const result: YouTubeSearchResult =
        await this.weatherForecastService.getYouTubeVideos(
          query || 'dự báo thời tiết Việt Nam',
          limit || 5,
        );

      this.logger.log(`Tìm thấy ${result.totalResults} video YouTube`);

      return result;
    } catch (error: any) {
      this.logger.error('Lỗi trong controller khi lấy YouTube videos:', error);

      throw new HttpException(
        {
          message: 'Không thể lấy danh sách video YouTube',
          error: error.message || 'Lỗi không xác định',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          timestamp: new Date().toISOString(),
          path: '/weather-forecast/youtube-videos',
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

  /**
   * Endpoint tạm thời để kích hoạt cron job thủ công
   * Dùng để kiểm tra chức năng lưu dữ liệu vào database
   */
  @Post('trigger-cron')
  @ApiOperation({
    summary: 'Kích hoạt cron job thủ công',
    description:
      'Endpoint tạm thời để kích hoạt cron job thủ công nhằm kiểm tra chức năng lưu dữ liệu',
  })
  @ApiResponse({
    status: 200,
    description: 'Cron job đã được thực thi thành công',
  })
  @ApiResponse({
    status: 500,
    description: 'Lỗi khi thực thi cron job',
  })
  async triggerCronJob() {
    try {
      this.logger.log('Nhận yêu cầu kích hoạt cron job thủ công');

      // Gọi service để thực thi cron job
      const result =
        await this.weatherForecastService.fetchAndSaveFullForecast();

      this.logger.log('Cron job đã được thực thi thành công');
      return {
        message: 'Cron job đã được thực thi thành công',
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi thực thi cron job:', error);

      throw new HttpException(
        {
          message: 'Không thể thực thi cron job',
          error: error.message || 'Lỗi không xác định',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
