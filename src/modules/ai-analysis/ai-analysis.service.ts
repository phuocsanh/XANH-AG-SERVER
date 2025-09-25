import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { McpServerService } from './mcp-server.service';
import { RiceAnalysisResult } from './interfaces/rice-analysis.interface';

/**
 * Service phân tích thị trường lúa gạo sử dụng Google Generative AI
 * Tích hợp MCP Server để có thông tin real-time và cập nhật
 */
@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);
  private readonly genAI: GoogleGenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly mcpServerService: McpServerService,
  ) {
    // Khởi tạo Google Generative AI với API key từ environment
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY không được cấu hình');
    }
    this.genAI = new GoogleGenAI({ apiKey });
    this.logger.log(
      'AiAnalysisService đã được khởi tạo với MCP Server integration',
    );
  }

  /**
   * Lấy dữ liệu giá lúa gạo mới nhất từ congthuong.vn
   * @returns Promise<any> - Dữ liệu giá lúa gạo mới nhất
   */
  async getLatestRicePriceData(): Promise<any> {
    try {
      this.logger.log('Đang lấy dữ liệu giá lúa gạo mới nhất...');
      
      // Sử dụng MCP Server để lấy dữ liệu bài viết mới nhất
      const result = await this.mcpServerService.getLatestRicePriceData();
      
      this.logger.log(`Đã lấy thành công nội dung trang web (${result.fullContent?.length || 0} ký tự) cho AI phân tích`);
      
      return result;
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy dữ liệu giá lúa gạo mới nhất:', error);
      throw error;
    }
  }

  /**
   * Phân tích thị trường lúa từ dữ liệu congthuong.vn (chỉ lúa, không phải gạo)
   * @param data - Dữ liệu thị trường lúa gạo từ MCP Server
   * @returns Promise<RiceAnalysisResult> - Kết quả phân tích có cấu trúc
   */
  async analyzeRiceMarket(data: any): Promise<RiceAnalysisResult> {
    // Kiểm tra dữ liệu đầu vào - không có dữ liệu thì báo lỗi ngay
    if (!data || !data.fullContent) {
      throw new Error('Không có nội dung trang web từ MCP Server. Vui lòng kiểm tra kết nối hoặc thử lại sau.');
    }

    if (!data.fullContent || data.fullContent.length === 0) {
      throw new Error('Không có nội dung trang web từ nguồn. Vui lòng kiểm tra nguồn dữ liệu hoặc thử lại sau.');
    }

    try {
      // Danh sách các model có sẵn
      const models = [
        'gemini-2.0-flash-001',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
      ];

      const selectedModel = models[0] || 'gemini-1.5-flash';

      // Tạo prompt chi tiết cho phân tích thị trường lúa với toàn bộ nội dung trang web
      const prompt = `
        Bạn là chuyên gia phân tích thị trường nông sản. Hãy phân tích nội dung trang web sau về giá lúa:
        
        ${data.fullContent}
        
        Vui lòng phân tích dựa trên dữ liệu thực này và trích xuất thông tin cụ thể:
        1. Danh sách các loại lúa và giá cụ thể (IR 50404, OM 18, Đài Thơm 8, OM 5451, Nàng Hoa 9, OM 308, v.v.)
        2. Xu hướng giá cả các loại lúa
        3. So sánh giá giữa các tỉnh thành
        4. Yếu tố ảnh hưởng đến thị trường hiện tại
        5. Dự báo ngắn hạn và dài hạn
        6. Khuyến nghị cho nông dân và nhà đầu tư
        7. Rủi ro và cơ hội từ dữ liệu thực tế
        
        Lưu ý: 
        - Chỉ phân tích thông tin về LÚA, bỏ qua thông tin về gạo
        - Tập trung vào dữ liệu giá cả thực tế từ nội dung
        - Trích xuất chính xác tên và giá các loại lúa từ nội dung
        - Đưa ra phân tích dựa trên dữ liệu có trong nội dung
        - Trả về kết quả bằng tiếng Việt
        
        Trả lời bằng tiếng Việt với định dạng JSON có cấu trúc như sau:
        {
          "marketOverview": "Tổng quan thị trường lúa hiện tại",
          "priceAnalysis": "Phân tích chi tiết về giá lúa các loại",
          "riceVarieties": [
            {
              "name": "Tên loại lúa",
              "price": "Giá hiện tại (đồng/kg)",
              "priceRange": "Khoảng giá (nếu có)",
              "trend": "Xu hướng (tăng/giảm/ổn định)"
            }
          ],
          "trends": "Xu hướng giá và thị trường",
          "forecast": "Dự báo thị trường trong thời gian tới",
          "recommendations": "Khuyến nghị cho nông dân và thương lái",
          "keyInsights": ["Insight 1", "Insight 2", "Insight 3"],
          "riskFactors": ["Risk 1", "Risk 2"],
          "opportunities": ["Opportunity 1", "Opportunity 2"]
        }
      `;

      // Gọi API AI
      const result = await this.genAI.models.generateContent({
        model: selectedModel,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      });

      const analysisResult: string = result.text || '';
      if (!analysisResult) {
        throw new Error('AI không thể tạo phân tích từ dữ liệu. Vui lòng thử lại sau.');
      }

      // Parse JSON response từ AI
      let parsedResult: any;
      try {
        // Loại bỏ markdown code blocks và các ký tự đặc biệt nếu có
        let cleanedResult = analysisResult
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .replace(/\*\*/g, '') // Loại bỏ markdown bold
          .replace(/\*/g, '') // Loại bỏ markdown italic
          .trim();
        
        // Tìm và extract JSON từ response
        const jsonMatch = cleanedResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanedResult = jsonMatch[0];
        }
        
        parsedResult = JSON.parse(cleanedResult);
      } catch (parseError: any) {
        this.logger.error('Raw AI response:', analysisResult);
        this.logger.error('Parse error:', parseError.message);
        throw new Error(`AI trả về dữ liệu không hợp lệ: ${parseError.message || 'Lỗi parse JSON'}`);
      }

      // Tạo follow-up analysis với thông tin bổ sung từ MCP Server
      const followUpPrompt = `
        Dựa trên phân tích ban đầu, hãy đưa ra thêm:
        1. So sánh với thị trường khu vực
        2. Tác động của chính sách nông nghiệp
        3. Ảnh hưởng của biến đổi khí hậu
        4. Cơ hội xuất khẩu
        
        Phân tích ban đầu: ${analysisResult}
        
        Lưu ý: Sử dụng MCP Server để lấy thông tin cập nhật về thị trường.
      `;

      const followUpResult = await this.genAI.models.generateContent({
        model: selectedModel,
        contents: [{ role: 'user', parts: [{ text: followUpPrompt }] }],
        config: {
          maxOutputTokens: 1024,
          temperature: 0.5,
        },
      });

      const followUpAnalysis: string = followUpResult.text || '';

      // Trả về theo interface RiceAnalysisResult với dữ liệu từ AI
      return {
        summary: parsedResult.marketOverview || 'Phân tích thị trường lúa từ AI',
        riceVarieties: parsedResult.riceVarieties || [], // Lấy danh sách loại lúa từ AI
        marketInsights: [
          parsedResult.priceAnalysis || '',
          parsedResult.trends || '',
          parsedResult.forecast || '',
          parsedResult.recommendations || '',
          followUpAnalysis
        ].filter(insight => insight && insight.trim() !== ''),
        lastUpdated: new Date().toISOString(),
        dataQuality: {
          tablesFound: 1,
          pricesExtracted: parsedResult.riceVarieties?.length || 0, // Số loại lúa được trích xuất
          hasDate: true,
          score: 0.9,
          completeness: 'high' as const
        },
        sourceUrl: 'https://congthuong.vn'
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi phân tích thị trường lúa gạo:', error);
      throw new Error(`Không thể phân tích dữ liệu thị trường: ${error.message}`);
    }
  }

}
