import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { AnalysisResponseDto } from './dto/analysis-response.dto';
import { WebSearchService, SearchResult } from './web-search.service';

/**
 * Service phân tích thị trường lúa gạo sử dụng Google Generative AI
 * Tích hợp web search để có thông tin real-time và cập nhật
 */
@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly webSearchService: WebSearchService,
  ) {
    // Khởi tạo Google Generative AI với API key từ environment
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY không được cấu hình');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.logger.log('AiAnalysisService đã được khởi tạo với web search capability');
  }



  /**
   * Tạo function declarations cho web search tools
   * @returns FunctionDeclaration[] - Danh sách các function có thể gọi
   */
  private createWebSearchTools(): FunctionDeclaration[] {
    return [
      {
        name: 'search_rice_market_info',
        description: 'Tìm kiếm thông tin real-time về thị trường lúa gạo, giá cả, xuất khẩu, chính sách',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            topic: {
              type: SchemaType.STRING,
              description: 'Chủ đề cần tìm kiếm (ví dụ: giá lúa hôm nay, xuất khẩu gạo, chính sách nông nghiệp)',
            },
          },
          required: ['topic'],
        },
      },
      {
        name: 'search_latest_rice_news',
        description: 'Tìm kiếm tin tức mới nhất về lúa gạo và nông nghiệp Việt Nam',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
        },
      },
      {
        name: 'search_general_web',
        description: 'Tìm kiếm thông tin tổng quát trên web về bất kỳ chủ đề nào',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: 'Từ khóa tìm kiếm',
            },
            count: {
              type: SchemaType.NUMBER,
              description: 'Số lượng kết quả mong muốn (mặc định 10)',
            },
          },
          required: ['query'],
        },
      },
    ];
  }

  /**
   * Xử lý function call từ AI
   * @param functionCall - Function call từ AI response
   * @returns Promise<string> - Kết quả của function call
   */
  private async handleFunctionCall(functionCall: any): Promise<string> {
    const { name, args } = functionCall;
    
    try {
      this.logger.log(`Đang thực hiện function call: ${name} với args:`, args);

      switch (name) {
        case 'search_rice_market_info':
          const riceResults = await this.webSearchService.searchRiceMarketInfo(args.topic);
          return this.formatSearchResults(riceResults, `Thông tin về ${args.topic}`);

        case 'search_latest_rice_news':
          const newsResults = await this.webSearchService.searchLatestRiceNews();
          return this.formatSearchResults(newsResults, 'Tin tức mới nhất về lúa gạo');

        case 'search_general_web':
          const webResults = await this.webSearchService.searchWeb(
            args.query, 
            args.count || 10, 
            true
          );
          return this.formatSearchResults(webResults, `Kết quả tìm kiếm: ${args.query}`);

        default:
          return `Function ${name} không được hỗ trợ`;
      }
    } catch (error: any) {
      this.logger.error(`Lỗi khi thực hiện function call ${name}:`, error);
      return `Lỗi khi tìm kiếm: ${error.message}`;
    }
  }

  /**
   * Format kết quả search thành text cho AI
   * @param results - Kết quả search
   * @param title - Tiêu đề cho kết quả
   * @returns string - Text đã được format
   */
  private formatSearchResults(results: SearchResult[], title: string): string {
    if (!results || results.length === 0) {
      return `${title}: Không tìm thấy kết quả nào.`;
    }

    let formatted = `${title} (${results.length} kết quả):\n\n`;
    
    results.forEach((result, index) => {
      formatted += `${index + 1}. **${result.title}**\n`;
      formatted += `   URL: ${result.url}\n`;
      formatted += `   Mô tả: ${result.description}\n`;
      if (result.published_date) {
        formatted += `   Ngày: ${result.published_date}\n`;
      }
      formatted += '\n';
    });

    return formatted;
   }

  /**
   * Phân tích thị trường lúa gạo sử dụng Gemini 2.5 Flash với web search
   * Có retry logic với exponential backoff và fallback mechanism
   * @returns Promise<AnalysisResponseDto> - Kết quả phân tích đã được cấu trúc
   */
  async analyzeRiceMarket(): Promise<AnalysisResponseDto> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 giây

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Bắt đầu phân tích thị trường lúa gạo (lần thử ${attempt}/${maxRetries})`);

        // Danh sách các model để thử theo thứ tự ưu tiên
        const models = [
          'gemini-2.0-flash-exp',
          'gemini-1.5-flash',
          'gemini-1.5-pro',
        ];

        let lastError: Error | null = null;

        // Thử từng model cho đến khi thành công
        for (const modelName of models) {
          try {
            this.logger.log(`Đang sử dụng model: ${modelName}`);
            
            const model = this.genAI.getGenerativeModel({ 
              model: modelName,
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
              },
              tools: [{ functionDeclarations: this.createWebSearchTools() }],
            });

            const prompt = this.createAnalysisPrompt();
            const result = await model.generateContent(prompt);
            const response = result.response;

            // Kiểm tra nếu AI muốn gọi function
            const candidate = response.candidates?.[0];
            if (candidate?.content?.parts) {
              const functionCalls = candidate.content.parts.filter(part => part.functionCall);
              
              if (functionCalls && functionCalls.length > 0) {
                this.logger.log(`AI yêu cầu ${functionCalls.length} function calls`);
                
                // Thực hiện tất cả function calls
                const functionResponseParts: any[] = [];
                for (const part of functionCalls) {
                  if (part.functionCall) {
                    const functionResult = await this.handleFunctionCall(part.functionCall);
                    functionResponseParts.push({
                      functionResponse: {
                        name: part.functionCall.name,
                        response: { result: functionResult },
                      },
                    });
                  }
                }

                // Gửi kết quả function calls về cho AI để tạo response cuối cùng
                const followUpResult = await model.generateContent([
                  { text: prompt },
                  ...candidate.content.parts,
                  ...functionResponseParts,
                ]);

                const finalResponse = followUpResult.response;
                const analysisText = finalResponse.text();

                if (!analysisText || analysisText.trim().length === 0) {
                  throw new Error(`Model ${modelName} trả về response rỗng sau function calls`);
                }

                this.logger.log(`Phân tích thành công với model: ${modelName} (có web search)`);
                return this.parseAnalysisResult(analysisText);
              } else {
                // Không có function calls, sử dụng response trực tiếp
                const analysisText = response.text();

                if (!analysisText || analysisText.trim().length === 0) {
                  throw new Error(`Model ${modelName} trả về response rỗng`);
                }

                this.logger.log(`Phân tích thành công với model: ${modelName} (không web search)`);
                return this.parseAnalysisResult(analysisText);
              }
            } else {
              // Không có candidate parts, sử dụng response trực tiếp
              const analysisText = response.text();

              if (!analysisText || analysisText.trim().length === 0) {
                throw new Error(`Model ${modelName} trả về response rỗng`);
              }

              this.logger.log(`Phân tích thành công với model: ${modelName} (không web search)`);
              return this.parseAnalysisResult(analysisText);
            }

          } catch (modelError: any) {
            this.logger.warn(`Model ${modelName} thất bại: ${modelError.message}`);
            lastError = modelError;
            continue;
          }
        }

        // Nếu tất cả models đều thất bại
        throw lastError || new Error('Tất cả models đều thất bại');

      } catch (error: any) {
        this.logger.error(`Lần thử ${attempt} thất bại:`, error);

        if (attempt === maxRetries) {
          this.logger.error('Đã hết số lần thử, trả về kết quả fallback');
          return this.getFallbackResult(error.message);
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.logger.log(`Chờ ${delay}ms trước khi thử lại...`);
        await this.sleep(delay);
      }
    }

    // Fallback cuối cùng (không bao giờ đến được đây nhưng để TypeScript hài lòng)
    return this.getFallbackResult('Lỗi không xác định');
  }

  /**
   * Hàm sleep để delay giữa các lần retry
   * @param ms - Số milliseconds cần delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Tạo prompt chi tiết cho AI để phân tích thị trường lúa gạo
   * Sử dụng kiến thức có sẵn của AI thay vì search web
   * @returns string - Prompt được cấu trúc
   */
  private createAnalysisPrompt(): string {
    return `
Bạn là chuyên gia phân tích thị trường nông sản Việt Nam, đặc biệt về lúa gạo. 
Hãy sử dụng kiến thức có sẵn của bạn để phân tích thị trường lúa gạo Việt Nam.

Yêu cầu phân tích chi tiết:

1. **Tóm tắt tình hình thị trường**: Phân tích tổng quan về tình hình giá lúa gạo hiện tại

2. **Thông tin giá tham khảo**:
   - Giá lúa tươi (VNĐ/kg) - các loại lúa phổ biến
   - Giá gạo xuất khẩu (USD/tấn) - theo từng loại gạo
   - Giá gạo trong nước (VNĐ/kg) - bán lẻ cho người tiêu dùng

3. **Xu hướng giá**: Phân tích xu hướng tăng/giảm/ổn định và dự báo ngắn hạn

4. **Thông tin chi tiết về các giống lúa**:
   - Tên các giống lúa được giao dịch (ST24, ST25, IR504, ĐT8, Jasmine, Nàng Hương, v.v.)
   - Giá tham khảo của từng giống
   - Khu vực/tỉnh thành chính (An Giang, Đồng Tháp, Kiên Giang, Cần Thơ, Sóc Trăng, v.v.)

5. **Phân tích thị trường**: 
   - Nguyên nhân ảnh hưởng đến giá
   - Tình hình cung cầu
   - Yếu tố thời tiết, chính sách
   - Thị trường xuất khẩu

**QUAN TRỌNG**: Trả về kết quả CHÍNH XÁC theo định dạng JSON sau, không thêm text khác:

{
  "summary": "Tóm tắt chi tiết tình hình thị trường lúa gạo hiện tại dựa trên kiến thức có sẵn",
  "priceData": {
    "freshRice": "Khoảng giá lúa tươi tham khảo",
    "exportRice": "Khoảng giá gạo xuất khẩu tham khảo", 
    "domesticRice": "Khoảng giá gạo trong nước tham khảo",
    "trend": "tăng" hoặc "giảm" hoặc "ổn định"
  },
  "riceVarieties": [
    {
      "variety": "Tên giống lúa cụ thể",
      "price": "Giá tham khảo với đơn vị",
      "province": "Tỉnh thành chính"
    }
  ],
  "marketInsights": [
    "Thông tin quan trọng 1",
    "Thông tin quan trọng 2",
    "Nguyên nhân ảnh hưởng đến giá"
  ],
  "lastUpdated": "Thời gian hiện tại"
}

Hãy sử dụng kiến thức có sẵn để cung cấp thông tin tham khảo hữu ích nhất.
    `;
  }

  /**
   * Parse kết quả phân tích từ AI thành structured data
   * @param analysisText - Text response từ AI
   * @returns AnalysisResponseDto - Dữ liệu đã được cấu trúc
   */
  private parseAnalysisResult(analysisText: string): AnalysisResponseDto {
    try {
      // Loại bỏ markdown formatting và whitespace
      const cleanText = analysisText
        .replace(/```json\n?|```\n?/g, '')
        .replace(/^\s+|\s+$/g, '')
        .trim();

      const parsed = JSON.parse(cleanText);

      // Validate và return structured data
      return {
        summary:
          parsed.summary || 'Đang cập nhật thông tin thị trường lúa gạo...',
        priceData: {
          freshRice: parsed.priceData?.freshRice || 'Đang cập nhật',
          exportRice: parsed.priceData?.exportRice || 'Đang cập nhật',
          domesticRice: parsed.priceData?.domesticRice || 'Đang cập nhật',
          trend: parsed.priceData?.trend || 'ổn định',
        },
        riceVarieties:
          Array.isArray(parsed.riceVarieties) && parsed.riceVarieties.length > 0
            ? parsed.riceVarieties
            : [
                {
                  variety: 'Đang cập nhật',
                  price: 'Đang cập nhật',
                  province: 'Đang cập nhật',
                },
              ],
        marketInsights:
          Array.isArray(parsed.marketInsights) &&
          parsed.marketInsights.length > 0
            ? parsed.marketInsights
            : ['Thông tin thị trường đang được cập nhật'],
        lastUpdated:
          parsed.lastUpdated ||
          new Date().toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
      };
    } catch (error) {
      this.logger.error('Lỗi parse JSON từ AI response:', error);

      // Fallback: Trả về dữ liệu với raw text
      return {
        summary:
          analysisText.length > 500
            ? analysisText.substring(0, 500) + '...'
            : analysisText,
        priceData: {
          freshRice: 'Đang xử lý dữ liệu',
          exportRice: 'Đang xử lý dữ liệu',
          domesticRice: 'Đang xử lý dữ liệu',
          trend: 'ổn định',
        },
        riceVarieties: [
          {
            variety: 'Đang xử lý',
            price: 'Đang xử lý',
            province: 'Đang xử lý',
          },
        ],
        marketInsights: ['Dữ liệu đang được xử lý, vui lòng thử lại sau'],
        lastUpdated: new Date().toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        }),
      };
    }
  }

  /**
   * Trả về kết quả fallback khi có lỗi
   * @param errorMessage - Thông báo lỗi
   * @returns AnalysisResponseDto - Kết quả fallback
   */
  private getFallbackResult(errorMessage: string): AnalysisResponseDto {
    this.logger.warn(`Sử dụng fallback result do lỗi: ${errorMessage}`);

    return {
      summary:
        'Hiện tại hệ thống đang gặp sự cố khi truy cập dữ liệu thị trường. Vui lòng thử lại sau.',
      priceData: {
        freshRice: 'Không thể cập nhật',
        exportRice: 'Không thể cập nhật',
        domesticRice: 'Không thể cập nhật',
        trend: 'ổn định',
      },
      riceVarieties: [
        { variety: 'Hệ thống đang bảo trì', price: 'N/A', province: 'N/A' },
      ],
      marketInsights: [
        'Hệ thống đang gặp sự cố tạm thời',
        'Vui lòng thử lại sau ít phút',
        `Chi tiết lỗi: ${errorMessage}`,
      ],
      lastUpdated: new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      }),
    };
  }
}