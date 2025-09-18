import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiAnalysisService } from './ai-analysis.service';
import { AnalysisResponseDto } from './dto/analysis-response.dto';

/**
 * Controller xử lý các API endpoint liên quan đến phân tích AI thị trường lúa gạo
 */
@ApiTags('AI Analysis')
@Controller('ai-analysis')
export class AiAnalysisController {
  private readonly logger = new Logger(AiAnalysisController.name);

  constructor(private readonly aiAnalysisService: AiAnalysisService) {}

  /**
   * Endpoint phân tích thị trường lúa gạo
   * Frontend chỉ cần gọi API này để nhận dữ liệu đã được phân tích
   * @returns Promise<AnalysisResponseDto> - Dữ liệu phân tích thị trường lúa gạo
   */
  @Get('rice-market')
  @ApiOperation({ 
    summary: 'Phân tích thị trường lúa gạo',
    description: 'Sử dụng AI để phân tích thị trường lúa gạo với dữ liệu thời gian thực từ web search'
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
  async analyzeRiceMarket(): Promise<AnalysisResponseDto> {
    try {
      this.logger.log('Nhận yêu cầu phân tích thị trường lúa gạo từ frontend');
      
      // Gọi service để thực hiện phân tích
      const result = await this.aiAnalysisService.analyzeRiceMarket();
      
      this.logger.log('Trả về kết quả phân tích thành công cho frontend');
      return result;
      
    } catch (error: any) {
      this.logger.error('Lỗi trong controller khi phân tích thị trường:', error);
      
      // Trả về response lỗi nhưng vẫn có cấu trúc dữ liệu
      return {
        summary: 'Hệ thống gặp sự cố khi phân tích thị trường lúa gạo',
        priceData: {
          freshRice: 'Không thể truy cập',
          exportRice: 'Không thể truy cập',
          domesticRice: 'Không thể truy cập',
          trend: 'ổn định'
        },
        riceVarieties: [
          { variety: 'Lỗi hệ thống', price: 'N/A', province: 'N/A' }
        ],
        marketInsights: [
          'Hệ thống đang gặp sự cố',
          'Vui lòng thử lại sau',
          `Lỗi: ${error?.message || 'Không xác định'}`
        ],
        lastUpdated: new Date().toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh'
        })
      };
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
}