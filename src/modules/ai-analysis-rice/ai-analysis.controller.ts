import {
  Controller,
  Get,
  Logger,
  HttpException,
  HttpStatus,
  Query,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { AiAnalysisService } from './ai-analysis.service';
import { AnalysisResponseDto } from './dto/analysis-response.dto';
import {
  RiceAnalysisResult,
  YouTubeSearchResult,
} from './interfaces/rice-analysis.interface';
import { McpServerService } from './mcp-server.service';
import { RiceMarketData } from '../../entities/rice-market.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Controller xử lý các API endpoint liên quan đến phân tích AI thị trường lúa gạo
 */
@ApiTags('AI Analysis')
@Controller('ai-analysis-rice')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiAnalysisController {
  private readonly logger = new Logger(AiAnalysisController.name);

  constructor(
    private readonly aiAnalysisService: AiAnalysisService,
    private readonly mcpServerService: McpServerService,
  ) {}

  /**
   * Endpoint phân tích thị trường lúa (chỉ lúa, không phải gạo)
   * Luồng: Lấy 5 bài viết đầu tiên từ congthuong.vn -> Lọc bài mới nhất có tiêu đề chứa 'Giá lúa gạo hôm nay ngày' -> Lấy dữ liệu giá lúa từ link chi tiết -> AI phân tích
   * @returns Promise<AnalysisResponseDto> - Dữ liệu phân tích thị trường lúa gạo
   */
  @Get('rice-market')
  @RequirePermissions('RICE_BLAST_VIEW')
  @ApiOperation({
    summary: 'Phân tích thị trường lúa gạo',
    description:
      'Phân tích thị trường lúa từ dữ liệu congthuong.vn (chỉ lúa, không phải gạo)',
  })
  @ApiResponse({
    status: 200,
    description: 'Phân tích thành công',
    type: AnalysisResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Lỗi server khi phân tích',
  })
  async analyzeRiceMarket(): Promise<RiceAnalysisResult> {
    try {
      this.logger.log('Nhận yêu cầu phân tích thị trường lúa gạo từ frontend');
      this.logger.log(
        'Bước 1: Lấy link chi tiết bài viết đầu tiên từ https://gaophuongnam.vn/gia-lua-gao-hom-nay',
      );

      // Bước 1: Lấy dữ liệu từ link chi tiết bài viết đầu tiên
      const realData = await this.aiAnalysisService.getLatestRicePriceData();
      this.logger.log(
        `Bước 2: Đã lấy được nội dung trang web, độ dài: ${realData.fullContent?.length || 0} ký tự`,
      );

      // Debug: Log một phần nội dung để kiểm tra
      if (realData.fullContent) {
        const preview = realData.fullContent.substring(0, 1500); // Tăng từ 500 lên 1500 ký tự
        this.logger.log(`Preview nội dung: ${preview}...`);

        // Log thêm thông tin về cấu trúc dữ liệu
        this.logger.log(
          `Tiêu đề bài viết: ${realData.title || 'Không có tiêu đề'}`,
        );
        this.logger.log(`Ngày bài viết: ${realData.date || 'Không có ngày'}`);
        this.logger.log(`URL nguồn: ${realData.url || 'Không có URL'}`);
      }

      // Bước 2: Gọi AI để phân tích dữ liệu từ link chi tiết
      this.logger.log('Bước 3: Đưa dữ liệu cho AI phân tích');
      this.logger.log(
        `Bắt đầu gọi AI với dữ liệu có độ dài: ${realData.fullContent?.length || 0} ký tự`,
      );

      const result = await this.aiAnalysisService.analyzeRiceMarket(realData);

      // Log chi tiết kết quả AI trả về
      this.logger.log(
        `AI đã phân tích xong. Số loại lúa tìm thấy: ${result.riceVarieties?.length || 0}`,
      );
      this.logger.log(
        `Điểm chất lượng dữ liệu: ${result.dataQuality?.score || 0}`,
      );
      this.logger.log(
        `Số bảng giá tìm thấy: ${result.dataQuality?.tablesFound || 0}`,
      );
      this.logger.log(
        `Số giá trích xuất được: ${result.dataQuality?.pricesExtracted || 0}`,
      );

      if (result.riceVarieties && result.riceVarieties.length > 0) {
        this.logger.log('Danh sách loại lúa tìm thấy:');
        result.riceVarieties.forEach((rice, index) => {
          // Log dữ liệu thực tế từ API response
          const riceData = rice as any; // Cast để truy cập thuộc tính động
          this.logger.log(
            `  ${index + 1}. ${riceData.name || rice.variety || 'N/A'}: ${riceData.price || rice.currentPrice || 'N/A'} (${riceData.trend || rice.change || 'không đổi'}) - ${rice.province || 'N/A'}`,
          );
        });
      }

      this.logger.log('Trả về kết quả phân tích thành công cho frontend');
      return result;
    } catch (error: any) {
      this.logger.error(
        'Lỗi trong controller khi phân tích thị trường:',
        error,
      );

      // Throw HTTP exception thay vì trả về dữ liệu giả
      throw new HttpException(
        {
          message: 'Không thể phân tích thị trường lúa gạo',
          error: error.message || 'Lỗi không xác định',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          timestamp: new Date().toISOString(),
          path: '/ai-analysis/rice-market',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Endpoint lấy dữ liệu thị trường gạo mới nhất từ database
   */
  @Get('latest-rice-market')
  @ApiOperation({
    summary: 'Lấy dữ liệu thị trường gạo mới nhất',
    description:
      'Trả về dữ liệu thị trường gạo mới nhất đã được lưu trữ trong database',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy dữ liệu thành công',
    type: RiceMarketData,
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy dữ liệu',
  })
  async getLatestRiceMarketData(): Promise<RiceMarketData> {
    try {
      this.logger.log('Nhận yêu cầu lấy dữ liệu thị trường gạo mới nhất');

      // Gọi service để lấy dữ liệu mới nhất từ database
      const result = await this.aiAnalysisService.getLatestRiceMarketData();

      if (!result) {
        throw new HttpException(
          {
            message: 'Không tìm thấy dữ liệu thị trường gạo',
            statusCode: HttpStatus.NOT_FOUND,
            timestamp: new Date().toISOString(),
            path: '/ai-analysis/latest-rice-market',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log('Trả về dữ liệu thị trường gạo mới nhất thành công');
      return result;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        'Lỗi trong controller khi lấy dữ liệu thị trường gạo:',
        error,
      );

      throw new HttpException(
        {
          message: 'Không thể lấy dữ liệu thị trường gạo mới nhất',
          error: error.message || 'Lỗi không xác định',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date().toISOString(),
          path: '/ai-analysis/latest-rice-market',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Endpoint kiểm tra trạng thái service AI
   * @returns Object - Thông tin trạng thái service
   */
  @Get('health')
  @ApiOperation({
    summary: 'Kiểm tra trạng thái AI service',
    description:
      'Endpoint để kiểm tra xem AI analysis service có hoạt động bình thường không',
  })
  @ApiResponse({
    status: 200,
    description: 'Service hoạt động bình thường',
  })
  async checkHealth() {
    this.logger.log('Kiểm tra trạng thái AI Analysis service');

    return {
      status: 'healthy',
      service: 'AI Analysis Service',
      timestamp: new Date().toISOString(),
      message: 'Service đang hoạt động bình thường',
    };
  }

  /**
   * Endpoint lấy danh sách video YouTube về giá lúa gạo hôm nay
   * @param query - Từ khóa tìm kiếm (mặc định: "giá lúa gạo hôm nay")
   * @param limit - Số lượng video tối đa (mặc định: 10)
   * @returns Promise<YouTubeSearchResult> - Danh sách video YouTube với thumbnail
   */
  @Get('youtube-videos')
  @ApiOperation({
    summary: 'Lấy video YouTube về giá lúa gạo',
    description:
      'Tìm kiếm và lấy danh sách video YouTube mới nhất về giá lúa gạo hôm nay với ảnh thumbnail',
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Từ khóa tìm kiếm (mặc định: "giá lúa gạo hôm nay")',
    example: 'giá lúa gạo hôm nay',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Số lượng video tối đa (mặc định: 10)',
    example: 10,
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
        `Nhận yêu cầu lấy YouTube videos với query: "${query || 'giá lúa gạo hôm nay'}", limit: ${limit || 10}`,
      );

      // Gọi MCP Server Service để lấy video YouTube
      const result = await this.mcpServerService.getYouTubeVideos(
        query || 'giá lúa gạo hôm nay',
        limit || 5,
      );

      this.logger.log(
        `Tìm thấy ${result.totalResults} video YouTube. Điểm chất lượng: ${result.searchQuality?.score || 0}/100`,
      );

      return result;
    } catch (error: any) {
      this.logger.error('Lỗi trong controller khi lấy YouTube videos:', error);

      throw new HttpException(
        {
          message: 'Không thể lấy danh sách video YouTube',
          error: error.message || 'Lỗi không xác định',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          timestamp: new Date().toISOString(),
          path: '/ai-analysis/youtube-videos',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Endpoint mới: Trả lời câu hỏi với trích dẫn nguồn giống Gemini
   * @param question - Câu hỏi của người dùng
   * @returns Promise<any> - Câu trả lời với trích dẫn nguồn
   */
  @Post('ask-with-sources')
  @ApiOperation({
    summary: 'Trả lời câu hỏi với trích dẫn nguồn (giống Gemini)',
    description:
      'Tìm kiếm thông tin từ web và trả lời câu hỏi với trích dẫn nguồn đáng tin cậy',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Câu hỏi cần trả lời',
          example: 'Giá lúa gạo hôm nay như thế nào?',
        },
      },
      required: ['question'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Trả lời thành công với trích dẫn nguồn',
  })
  @ApiResponse({
    status: 400,
    description: 'Câu hỏi không hợp lệ',
  })
  @ApiResponse({
    status: 500,
    description: 'Lỗi server khi tìm kiếm thông tin',
  })
  async askWithSources(@Body('question') question: string): Promise<any> {
    try {
      this.logger.log(`Nhận câu hỏi từ người dùng: ${question}`);

      // Kiểm tra đầu vào
      if (!question || question.trim().length === 0) {
        throw new HttpException(
          {
            message: 'Câu hỏi không được để trống',
            statusCode: HttpStatus.BAD_REQUEST,
            timestamp: new Date().toISOString(),
            path: '/ai-analysis/ask-with-sources',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Gọi service để trả lời câu hỏi với nguồn
      const result = await this.aiAnalysisService.answerQuestionWithSources(
        question.trim(),
      );

      this.logger.log(
        `Đã trả lời câu hỏi với ${result.sources?.length || 0} nguồn tham khảo`,
      );

      return result;
    } catch (error: any) {
      this.logger.error('Lỗi khi trả lời câu hỏi với nguồn:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          message: 'Không thể trả lời câu hỏi',
          error: error.message || 'Lỗi không xác định',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          timestamp: new Date().toISOString(),
          path: '/ai-analysis/ask-with-sources',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Endpoint GET để trả lời câu hỏi nhanh qua query parameter
   * @param q - Câu hỏi ngắn gọn
   * @returns Promise<any> - Câu trả lời với trích dẫn nguồn
   */
  @Get('quick-ask')
  @ApiOperation({
    summary: 'Trả lời câu hỏi nhanh (GET method)',
    description:
      'Trả lời câu hỏi ngắn gọn qua query parameter với trích dẫn nguồn',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Câu hỏi cần trả lời',
    example: 'giá lúa hôm nay',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả lời thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Thiếu câu hỏi',
  })
  async quickAsk(@Query('q') question: string): Promise<any> {
    try {
      this.logger.log(`Nhận câu hỏi nhanh: ${question}`);

      if (!question || question.trim().length === 0) {
        throw new HttpException(
          {
            message: 'Tham số "q" (câu hỏi) là bắt buộc',
            statusCode: HttpStatus.BAD_REQUEST,
            timestamp: new Date().toISOString(),
            path: '/ai-analysis/quick-ask',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.aiAnalysisService.answerQuestionWithSources(
        question.trim(),
      );

      this.logger.log(
        `Đã trả lời câu hỏi nhanh với ${result.sources?.length || 0} nguồn`,
      );

      return result;
    } catch (error: any) {
      this.logger.error('Lỗi khi trả lời câu hỏi nhanh:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          message: 'Không thể trả lời câu hỏi',
          error: error.message || 'Lỗi không xác định',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          timestamp: new Date().toISOString(),
          path: '/ai-analysis/quick-ask',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Endpoint tạm thời để kích hoạt cron job thủ công cho rice market
   * Dùng để kiểm tra chức năng lưu dữ liệu vào database
   */
  @Post('trigger-rice-cron')
  @ApiOperation({
    summary: 'Kích hoạt cron job rice market thủ công',
    description:
      'Endpoint tạm thời để kích hoạt cron job thủ công nhằm kiểm tra chức năng lưu dữ liệu rice market',
  })
  @ApiResponse({
    status: 200,
    description: 'Cron job đã được thực thi thành công',
  })
  @ApiResponse({
    status: 500,
    description: 'Lỗi khi thực thi cron job',
  })
  async triggerRiceMarketCronJob() {
    try {
      this.logger.log('Nhận yêu cầu kích hoạt cron job rice market thủ công');

      // Gọi service để thực thi cron job
      const result = await this.aiAnalysisService.fetchAndSaveRiceMarketData();

      this.logger.log('Cron job rice market đã được thực thi thành công');
      return {
        message: 'Cron job rice market đã được thực thi thành công',
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi thực thi cron job rice market:', error);

      throw new HttpException(
        {
          message: 'Không thể thực thi cron job rice market',
          error: error.message || 'Lỗi không xác định',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
