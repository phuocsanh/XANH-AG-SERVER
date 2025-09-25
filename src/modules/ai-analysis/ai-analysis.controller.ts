import { Controller, Get, Logger, HttpException, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AiAnalysisService } from './ai-analysis.service';
import { AnalysisResponseDto } from './dto/analysis-response.dto';
import { RiceAnalysisResult, YouTubeSearchResult } from './interfaces/rice-analysis.interface';
import { McpServerService } from './mcp-server.service';

/**
 * Controller xử lý các API endpoint liên quan đến phân tích AI thị trường lúa gạo
 */
@ApiTags('AI Analysis')
@Controller('ai-analysis')
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
  @ApiOperation({ 
    summary: 'Phân tích thị trường lúa gạo',
    description: 'Phân tích thị trường lúa từ dữ liệu congthuong.vn (chỉ lúa, không phải gạo)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Phân tích thành công',
    type: AnalysisResponseDto
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Lỗi server khi phân tích' 
  })
  async analyzeRiceMarket(): Promise<RiceAnalysisResult> {
    try {
      this.logger.log('Nhận yêu cầu phân tích thị trường lúa gạo từ frontend');
      this.logger.log('Bước 1: Lấy link chi tiết bài viết đầu tiên từ https://gaophuongnam.vn/gia-lua-gao-hom-nay');
      
      // Bước 1: Lấy dữ liệu từ link chi tiết bài viết đầu tiên
      const realData = await this.aiAnalysisService.getLatestRicePriceData();
      this.logger.log(`Bước 2: Đã lấy được nội dung trang web, độ dài: ${realData.fullContent?.length || 0} ký tự`);
      
      // Debug: Log một phần nội dung để kiểm tra
      if (realData.fullContent) {
        const preview = realData.fullContent.substring(0, 1500); // Tăng từ 500 lên 1500 ký tự
        this.logger.log(`Preview nội dung: ${preview}...`);
        
        // Log thêm thông tin về cấu trúc dữ liệu
        this.logger.log(`Tiêu đề bài viết: ${realData.title || 'Không có tiêu đề'}`);
        this.logger.log(`Ngày bài viết: ${realData.date || 'Không có ngày'}`);
        this.logger.log(`URL nguồn: ${realData.url || 'Không có URL'}`);
      }
      
      // Bước 2: Gọi AI để phân tích dữ liệu từ link chi tiết
      this.logger.log('Bước 3: Đưa dữ liệu cho AI phân tích');
      this.logger.log(`Bắt đầu gọi AI với dữ liệu có độ dài: ${realData.fullContent?.length || 0} ký tự`);
      
      const result = await this.aiAnalysisService.analyzeRiceMarket(realData);
      
      // Log chi tiết kết quả AI trả về
      this.logger.log(`AI đã phân tích xong. Số loại lúa tìm thấy: ${result.riceVarieties?.length || 0}`);
      this.logger.log(`Điểm chất lượng dữ liệu: ${result.dataQuality?.score || 0}`);
      this.logger.log(`Số bảng giá tìm thấy: ${result.dataQuality?.tablesFound || 0}`);
      this.logger.log(`Số giá trích xuất được: ${result.dataQuality?.pricesExtracted || 0}`);
      
      if (result.riceVarieties && result.riceVarieties.length > 0) {
         this.logger.log('Danh sách loại lúa tìm thấy:');
         result.riceVarieties.forEach((rice, index) => {
           // Log dữ liệu thực tế từ API response
           const riceData = rice as any; // Cast để truy cập thuộc tính động
           this.logger.log(`  ${index + 1}. ${riceData.name || rice.variety || 'N/A'}: ${riceData.price || rice.currentPrice || 'N/A'} (${riceData.trend || rice.change || 'không đổi'}) - ${rice.province || 'N/A'}`);
         });
       }
      
      this.logger.log('Trả về kết quả phân tích thành công cho frontend');
      return result;
      
    } catch (error: any) {
      this.logger.error('Lỗi trong controller khi phân tích thị trường:', error);
      
      // Throw HTTP exception thay vì trả về dữ liệu giả
      throw new HttpException(
        {
          message: 'Không thể phân tích thị trường lúa gạo',
          error: error.message || 'Lỗi không xác định',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          timestamp: new Date().toISOString(),
          path: '/ai-analysis/rice-market'
        },
        HttpStatus.SERVICE_UNAVAILABLE
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
    description: 'Endpoint để kiểm tra xem AI analysis service có hoạt động bình thường không'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service hoạt động bình thường' 
  })
  async checkHealth() {
    this.logger.log('Kiểm tra trạng thái AI Analysis service');
    
    return {
      status: 'healthy',
      service: 'AI Analysis Service',
      timestamp: new Date().toISOString(),
      message: 'Service đang hoạt động bình thường'
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
    description: 'Tìm kiếm và lấy danh sách video YouTube mới nhất về giá lúa gạo hôm nay với ảnh thumbnail'
  })
  @ApiQuery({ 
    name: 'query', 
    required: false, 
    description: 'Từ khóa tìm kiếm (mặc định: "giá lúa gạo hôm nay")',
    example: 'giá lúa gạo hôm nay'
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    description: 'Số lượng video tối đa (mặc định: 10)',
    example: 10
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lấy danh sách video thành công',
    schema: {
      type: 'object',
      properties: {
        videos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID video YouTube' },
              title: { type: 'string', description: 'Tiêu đề video' },
              url: { type: 'string', description: 'URL video YouTube' },
              thumbnail: { type: 'string', description: 'URL ảnh thumbnail' },
              channel: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Tên kênh' },
                  url: { type: 'string', description: 'URL kênh' }
                }
              },
              duration: { type: 'string', description: 'Thời lượng video' },
              views: { type: 'string', description: 'Số lượt xem' },
              uploadTime: { type: 'string', description: 'Thời gian upload' },
              description: { type: 'string', description: 'Mô tả video' },
              isLive: { type: 'boolean', description: 'Video live hay không' }
            }
          }
        },
        query: { type: 'string', description: 'Từ khóa tìm kiếm' },
        searchTime: { type: 'string', description: 'Thời gian tìm kiếm' },
        totalResults: { type: 'number', description: 'Tổng số video tìm được' },
        searchQuality: {
          type: 'object',
          properties: {
            hasRecentVideos: { type: 'boolean', description: 'Có video gần đây không' },
            todayVideosCount: { type: 'number', description: 'Số video có từ "hôm nay"' },
            score: { type: 'number', description: 'Điểm chất lượng (0-100)' }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Lỗi server khi tìm kiếm video' 
  })
  async getYouTubeVideos(
    @Query('query') query?: string,
    @Query('limit') limit?: number,
  ): Promise<YouTubeSearchResult> {
    try {
      this.logger.log(`Nhận yêu cầu lấy YouTube videos với query: "${query || 'giá lúa gạo hôm nay'}", limit: ${limit || 10}`);
      
      // Gọi MCP Server Service để lấy video YouTube
      const result = await this.mcpServerService.getYouTubeVideos(
        query || 'giá lúa gạo hôm nay',
        limit || 10
      );

      this.logger.log(`Tìm thấy ${result.totalResults} video YouTube. Điểm chất lượng: ${result.searchQuality?.score || 0}/100`);
      
      return result;

    } catch (error: any) {
      this.logger.error('Lỗi trong controller khi lấy YouTube videos:', error);
      
      throw new HttpException(
        {
          message: 'Không thể lấy danh sách video YouTube',
          error: error.message || 'Lỗi không xác định',
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          timestamp: new Date().toISOString(),
          path: '/ai-analysis/youtube-videos'
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}