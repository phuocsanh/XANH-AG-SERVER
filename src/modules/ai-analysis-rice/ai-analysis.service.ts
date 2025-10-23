import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { McpServerService } from './mcp-server.service';
import { RiceAnalysisResult } from './interfaces/rice-analysis.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiceMarketData } from '../../entities/rice-market.entity';
import { Cron } from '@nestjs/schedule';

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
    @InjectRepository(RiceMarketData)
    private readonly riceMarketRepository: Repository<RiceMarketData>,
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
   * Cron job chạy tự động 2 lần mỗi ngày (7:00 sáng và 16:00 chiều)
   * để thu thập và lưu trữ dữ liệu thị trường gạo
   */
  @Cron('0 0 7,16 * * *')
  async handleRiceMarketCron() {
    this.logger.log('Bắt đầu chạy cron job thu thập dữ liệu thị trường gạo...');
    try {
      await this.fetchAndSaveRiceMarketData();
      this.logger.log(
        'Cron job thu thập dữ liệu thị trường gạo hoàn thành thành công',
      );
    } catch (error) {
      this.logger.error(
        'Lỗi khi chạy cron job thu thập dữ liệu thị trường gạo:',
        error,
      );
    }
  }

  /**
   * Thu thập dữ liệu thị trường gạo và lưu vào database (chỉ duy trì 1 bản ghi duy nhất)
   */
  async fetchAndSaveRiceMarketData(): Promise<RiceMarketData> {
    try {
      // Gọi phương thức lấy dữ liệu giá lúa gạo mới nhất
      const riceData = await this.getLatestRicePriceData();

      // Phân tích dữ liệu thị trường gạo
      const result = await this.analyzeRiceMarket(riceData);

      // Kiểm tra xem đã có bản ghi nào chưa
      const existingData = await this.riceMarketRepository
        .createQueryBuilder('rice')
        .orderBy('rice.createdAt', 'DESC')
        .getOne();

      let riceMarketData: RiceMarketData;

      if (existingData) {
        // Nếu đã có bản ghi, cập nhật nó
        this.logger.log('Đã có bản ghi thị trường gạo, cập nhật dữ liệu...');
        riceMarketData = existingData;
        riceMarketData.summary = result.summary;
        riceMarketData.priceAnalysis = result.marketInsights.join('\n\n');
        riceMarketData.supplyDemand = ''; // Có thể cập nhật sau nếu cần
        riceMarketData.exportImportInfo = ''; // Có thể cập nhật sau nếu cần
        riceMarketData.relatedNews = []; // Có thể cập nhật sau nếu cần
        riceMarketData.lastUpdated = new Date(result.lastUpdated);
        riceMarketData.dataSources = result.additionalSources || [];
        riceMarketData.dataQuality = {
          reliability: result.dataQuality?.completeness || 'medium',
          sourcesUsed: result.dataQuality?.pricesExtracted || 0,
          score: Math.round((result.dataQuality?.score || 0) * 100),
        };
      } else {
        // Nếu chưa có bản ghi, tạo mới
        this.logger.log('Chưa có bản ghi thị trường gạo, tạo mới dữ liệu...');
        riceMarketData = new RiceMarketData();
        riceMarketData.summary = result.summary;
        riceMarketData.priceAnalysis = result.marketInsights.join('\n\n');
        riceMarketData.supplyDemand = ''; // Có thể cập nhật sau nếu cần
        riceMarketData.exportImportInfo = ''; // Có thể cập nhật sau nếu cần
        riceMarketData.relatedNews = []; // Có thể cập nhật sau nếu cần
        riceMarketData.lastUpdated = new Date(result.lastUpdated);
        riceMarketData.dataSources = result.additionalSources || [];
        riceMarketData.dataQuality = {
          reliability: result.dataQuality?.completeness || 'medium',
          sourcesUsed: result.dataQuality?.pricesExtracted || 0,
          score: Math.round((result.dataQuality?.score || 0) * 100),
        };
      }

      // Lưu vào database
      const savedData = await this.riceMarketRepository.save(riceMarketData);
      this.logger.log(
        `Đã lưu dữ liệu thị trường gạo vào database với ID: ${savedData.id}`,
      );
      return savedData;
    } catch (error) {
      this.logger.error(
        'Lỗi khi thu thập và lưu dữ liệu thị trường gạo:',
        error,
      );
      throw error;
    }
  }

  /**
   * Lấy dữ liệu thị trường gạo mới nhất từ database
   */
  async getLatestRiceMarketData(): Promise<RiceMarketData | null> {
    try {
      const latestData = await this.riceMarketRepository
        .createQueryBuilder('rice')
        .orderBy('rice.createdAt', 'DESC')
        .limit(1)
        .getOne();

      return latestData;
    } catch (error) {
      this.logger.error('Lỗi khi lấy dữ liệu thị trường gạo mới nhất:', error);
      throw error;
    }
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

      this.logger.log(
        `Đã lấy thành công nội dung trang web (${result.fullContent?.length || 0} ký tự) cho AI phân tích`,
      );

      return result;
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy dữ liệu giá lúa gạo mới nhất:', error);
      throw error;
    }
  }

  /**
   * Phân tích thị trường lúa từ dữ liệu congthuong.vn (chỉ lúa, không phải gạo)
   * Tích hợp tìm kiếm web thời gian thực để có thông tin cập nhật nhất
   * @param data - Dữ liệu thị trường lúa gạo từ MCP Server
   * @returns Promise<RiceAnalysisResult> - Kết quả phân tích có cấu trúc với trích dẫn nguồn
   */
  async analyzeRiceMarket(data: any): Promise<RiceAnalysisResult> {
    // Kiểm tra dữ liệu đầu vào - không có dữ liệu thì báo lỗi ngay
    if (!data || !data.fullContent) {
      throw new Error(
        'Không có nội dung trang web từ MCP Server. Vui lòng kiểm tra kết nối hoặc thử lại sau.',
      );
    }

    if (!data.fullContent || data.fullContent.length === 0) {
      throw new Error(
        'Không có nội dung trang web từ nguồn. Vui lòng kiểm tra nguồn dữ liệu hoặc thử lại sau.',
      );
    }

    try {
      // Lấy thông tin bổ sung từ tìm kiếm web thời gian thực
      let additionalWebData = '';
      let webSources: string[] = [];

      try {
        this.logger.log('Đang tìm kiếm thông tin bổ sung từ web...');
        const webSearchResult =
          await this.mcpServerService.searchRiceNewsMultiSource();

        if (webSearchResult && webSearchResult.aggregatedContent) {
          additionalWebData = webSearchResult.aggregatedContent;
          webSources = webSearchResult.sources || [];
          this.logger.log(
            `Đã lấy thêm ${webSources.length} nguồn từ web search`,
          );
        }
      } catch (webError: any) {
        this.logger.warn(
          'Không thể lấy dữ liệu từ web search, sử dụng dữ liệu cục bộ:',
          webError.message,
        );
      }

      // Sử dụng model Gemini 2.0 flash - model ổn định nhất hiện tại
      const selectedModel = 'gemini-2.0-flash-001';

      // Tạo prompt chi tiết với yêu cầu trích dẫn nguồn và tránh hallucination
      const prompt = `
        Bạn là chuyên gia phân tích thị trường nông sản. Hãy phân tích nội dung sau về giá lúa:
        
        NGUỒN CHÍNH (congthuong.vn):
        ${data.fullContent}
        
        ${
          additionalWebData
            ? `NGUỒN BỔ SUNG TỪ WEB:
        ${additionalWebData}
        
        DANH SÁCH NGUỒN THAM KHẢO:
        ${webSources.map((source, index) => `${index + 1}. ${source}`).join('\n')}
        `
            : ''
        }
        
        QUAN TRỌNG - QUY TẮC PHÂN TÍCH:
        1. CHỈ sử dụng dữ liệu có trong nội dung được cung cấp ở trên
        2. KHÔNG tự tạo ra thông tin, số liệu, hoặc giá cả không có trong nguồn
        3. Nếu không có thông tin cụ thể nào đó, hãy nói "Không có dữ liệu" thay vì đoán
        4. LUÔN trích dẫn nguồn gốc cho mỗi thông tin quan trọng
        5. Phân biệt rõ ràng giữa dữ liệu thực tế và dự đoán/phân tích
        
        Vui lòng phân tích dựa trên dữ liệu thực này và trích xuất thông tin cụ thể:
        1. Danh sách các loại lúa và giá cụ thể (IR 50404, OM 18, Đài Thơm 8, OM 5451, Nàng Hoa 9, OM 308, v.v.)
        2. Xu hướng giá cả các loại lúa (chỉ dựa trên dữ liệu có sẵn)
        3. So sánh giá giữa các tỉnh thành (nếu có trong dữ liệu)
        4. Yếu tố ảnh hưởng đến thị trường hiện tại (chỉ những gì được đề cập trong nguồn)
        5. Dự báo ngắn hạn (chỉ nếu có trong nguồn, không tự đoán)
        6. Khuyến nghị dựa trên dữ liệu thực tế
        7. Rủi ro và cơ hội từ dữ liệu có sẵn
        
        Lưu ý: 
        - Chỉ phân tích thông tin về LÚA, bỏ qua thông tin về gạo
        - Tập trung vào dữ liệu giá cả thực tế từ nội dung
        - Trích xuất chính xác tên và giá các loại lúa từ nội dung
        - Đưa ra phân tích dựa trên dữ liệu có trong nội dung
        - LUÔN liệt kê nguồn gốc thông tin ở cuối mỗi phần phân tích
        - Trả về kết quả bằng tiếng Việt
        
        Trả lời bằng tiếng Việt với định dạng JSON có cấu trúc như sau:
        {
          "marketOverview": "Tổng quan thị trường lúa hiện tại (kèm nguồn)",
          "priceAnalysis": "Phân tích chi tiết về giá lúa các loại (kèm nguồn)",
          "riceVarieties": [
            {
              "name": "Tên loại lúa",
              "price": "Giá hiện tại (đồng/kg)",
              "priceRange": "Khoảng giá (nếu có)",
              "trend": "Xu hướng (tăng/giảm/ổn định)",
              "source": "Nguồn thông tin cụ thể"
            }
          ],
          "trends": "Xu hướng giá và thị trường (kèm nguồn)",
          "forecast": "Dự báo thị trường trong thời gian tới (chỉ nếu có trong nguồn)",
          "recommendations": "Khuyến nghị cho nông dân và thương lái (dựa trên dữ liệu thực)",
          "keyInsights": ["Insight 1 (nguồn)", "Insight 2 (nguồn)", "Insight 3 (nguồn)"],
          "riskFactors": ["Risk 1 (nguồn)", "Risk 2 (nguồn)"],
          "opportunities": ["Opportunity 1 (nguồn)", "Opportunity 2 (nguồn)"],
          "dataSources": ["Danh sách tất cả nguồn được sử dụng"],
          "dataLimitations": "Những hạn chế của dữ liệu hiện có"
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
        throw new Error(
          'AI không thể tạo phân tích từ dữ liệu. Vui lòng thử lại sau.',
        );
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
        throw new Error(
          `AI trả về dữ liệu không hợp lệ: ${parseError.message || 'Lỗi parse JSON'}`,
        );
      }

      // Tạo follow-up analysis với thông tin bổ sung từ MCP Server
      const followUpPrompt = `
        Dựa trên phân tích ban đầu, hãy đưa ra thêm:
        1. So sánh với thị trường khu vực
        2. Tác động của chính sách nông nghiệp
        3. Ảnh hưởng của biến đổi khí hậu
        4. Cơ hội xuất khẩu
        
        QUY TẮC QUAN TRỌNG:
        - CHỈ sử dụng dữ liệu từ nguồn đã cung cấp
        - KHÔNG tự tạo thông tin hoặc đoán mò
        - Nếu không có dữ liệu về một khía cạnh nào đó, hãy nói "Không có thông tin trong nguồn dữ liệu hiện tại"
        - LUÔN liệt kê nguồn gốc cho mỗi thông tin
        
        Phân tích ban đầu: ${analysisResult}
        
        Nguồn dữ liệu có sẵn:
        - congthuong.vn: ${data.sourceUrl || 'https://congthuong.vn'}
        ${webSources.length > 0 ? `- Các nguồn web bổ sung: ${webSources.join(', ')}` : ''}
        
        Trả về phân tích bổ sung với format: "Nội dung phân tích (Nguồn: tên nguồn)"
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

      // Trả về theo interface RiceAnalysisResult với dữ liệu từ AI và thông tin nguồn
      return {
        summary:
          parsedResult.marketOverview || 'Phân tích thị trường lúa từ AI',
        riceVarieties: parsedResult.riceVarieties || [], // Lấy danh sách loại lúa từ AI
        marketInsights: [
          parsedResult.priceAnalysis || '',
          parsedResult.trends || '',
          parsedResult.forecast || '',
          parsedResult.recommendations || '',
          followUpAnalysis,
          // Thêm thông tin về nguồn dữ liệu
          `Nguồn dữ liệu: ${[data.sourceUrl || 'congthuong.vn', ...webSources].join(', ')}`,
          parsedResult.dataLimitations
            ? `Hạn chế dữ liệu: ${parsedResult.dataLimitations}`
            : '',
        ].filter((insight) => insight && insight.trim() !== ''),
        lastUpdated: new Date().toISOString(),
        dataQuality: {
          tablesFound: 1,
          pricesExtracted: parsedResult.riceVarieties?.length || 0, // Số loại lúa được trích xuất
          hasDate: true,
          score: webSources.length > 0 ? 0.95 : 0.9, // Điểm cao hơn nếu có nhiều nguồn
          completeness: webSources.length > 2 ? 'high' : ('medium' as const),
        },
        sourceUrl: data.sourceUrl || 'https://congthuong.vn',
        // Thêm thông tin về các nguồn bổ sung
        additionalSources: webSources,
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi phân tích thị trường lúa gạo:', error);
      throw new Error(
        `Không thể phân tích dữ liệu thị trường: ${error.message}`,
      );
    }
  }

  /**
   * Trả lời câu hỏi với trích dẫn nguồn (giống Gemini)
   * @param question - Câu hỏi của người dùng
   * @returns Promise<any> - Câu trả lời với trích dẫn nguồn
   */
  async answerQuestionWithSources(question: string): Promise<any> {
    try {
      this.logger.log(`Bắt đầu trả lời câu hỏi: ${question}`);

      // Bước 1: Tìm kiếm thông tin từ web
      this.logger.log('Tìm kiếm thông tin từ web...');
      const webSearchResult =
        await this.mcpServerService.searchRiceNewsMultiSource(question);
      const webSources = webSearchResult.sources || [];

      // Bước 2: Tạo prompt cho AI với thông tin từ web
      const prompt = `
Bạn là một chuyên gia phân tích thị trường nông nghiệp. Hãy trả lời câu hỏi sau dựa trên thông tin được cung cấp:

Câu hỏi: ${question}

Thông tin từ các nguồn web:
${webSources
  .map(
    (source, index) => `
Nguồn ${index + 1}: ${source.title}
URL: ${source.url}
Nội dung: ${source.snippet}
---
`,
  )
  .join('\n')}

YÊU CẦU QUAN TRỌNG:
1. CHỈ sử dụng thông tin từ các nguồn được cung cấp ở trên
2. KHÔNG tự tạo ra thông tin không có trong nguồn
3. Nếu không có thông tin đủ để trả lời, hãy nói "Không có đủ thông tin từ các nguồn hiện tại"
4. LUÔN trích dẫn nguồn cụ thể khi đưa ra thông tin
5. Trả lời bằng tiếng Việt
6. Cấu trúc câu trả lời rõ ràng, dễ hiểu

Hãy trả lời câu hỏi một cách chính xác và có trích dẫn nguồn.
`;

      // Bước 3: Gọi AI để tạo câu trả lời
      this.logger.log('Gọi AI để tạo câu trả lời...');
      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash-001',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
      });
      const answer = result.text || 'Không thể tạo câu trả lời';

      // Bước 4: Tạo kết quả với trích dẫn nguồn
      const finalResult = {
        answer: answer,
        sources: webSources.map((source) => ({
          title: source.title,
          url: source.url,
          snippet: source.snippet
            ? source.snippet.substring(0, 200) + '...'
            : 'Không có mô tả',
        })),
        confidence: webSources.length > 0 ? 0.8 : 0.3, // Độ tin cậy dựa trên số nguồn
        timestamp: new Date().toISOString(),
        searchQuery: question,
        totalSources: webSources.length,
      };

      this.logger.log(
        `Đã trả lời câu hỏi với ${webSources.length} nguồn tham khảo`,
      );
      return finalResult;
    } catch (error: any) {
      this.logger.error('Lỗi khi trả lời câu hỏi với nguồn:', error);

      // Trả về câu trả lời lỗi với thông tin chi tiết
      return {
        answer:
          'Xin lỗi, tôi không thể trả lời câu hỏi này do gặp lỗi kỹ thuật. Vui lòng thử lại sau.',
        sources: [],
        confidence: 0,
        timestamp: new Date().toISOString(),
        searchQuery: question,
        error: error.message,
        totalSources: 0,
      };
    }
  }
}
