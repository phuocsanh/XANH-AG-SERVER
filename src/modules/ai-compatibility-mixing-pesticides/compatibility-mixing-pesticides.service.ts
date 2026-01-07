import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import {
  PESTICIDE_MIXING_DOCUMENT_TEXT,
  PESTICIDE_MIXING_REFERENCE_LINKS,
} from './data/pesticide-mixing.data';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class CompatibilityMixingPesticidesService {
  private readonly logger = new Logger(CompatibilityMixingPesticidesService.name);
  private readonly model = 'gemini-2.5-flash';

  constructor(private firebaseService: FirebaseService) {}

  /**
   * Thực hiện truy vấn AI, kết hợp RAG (tài liệu nội bộ) và trả lời câu hỏi.
   * @param userQuestion Câu hỏi của người dùng
   * @returns Câu trả lời từ AI
   */
  async mixPesticides(userQuestion: string): Promise<string> {
    // 1. Tạo Prompt cuối cùng với dữ liệu RAG
    const finalPrompt = `
      Hãy sử dụng tài liệu hướng dẫn phối trộn thuốc Bảo Vệ Thực Vật sau đây để trả lời câu hỏi.
      Nếu thông tin trong tài liệu không đủ, hãy sử dụng công cụ tìm kiếm Google để tìm kiếm thông tin bổ sung và trả lời câu hỏi.

      --- TÀI LIỆU NỀN TẢNG ---
      ${PESTICIDE_MIXING_DOCUMENT_TEXT}
      --- KẾT THÚC TÀI LIỆU ---

      --- CÁC LIÊN KẾT THAM KHẢO ---
      ${PESTICIDE_MIXING_REFERENCE_LINKS.map((link) => `- ${link}`).join('\n')}
      --- KẾT THÚC LIÊN KẾT ---

      Câu hỏi cần trả lời: ${userQuestion}
      - Luôn đọc kỹ, phân tích tài liệu và nguồn dữ liệu trước khi trả lời câu hỏi.
      - Hãy trả lời bằng tiếng Việt dựa trên tài liệu được cung cấp.
      - Nếu bạn cần tìm kiếm thông tin từ các liên kết hoặc sử dụng công cụ tìm kiếm, hãy thực hiện việc đó để cung cấp câu trả lời chính xác nhất.
      - Cố gắng trả lời và giải thích ngắn gọn tập trung vào câu hỏi thôi, để nông dân việt dễ hiểu không dùng các từ tiếng anh và từ viết tắt.
    `;

    try {
      this.logger.log('🚀 Starting AI processing with Google Search tool...');

      // Lấy API Key từ Firebase Remote Config (Cơ chế xoay vòng Key)
      const apiKeyConfig = await this.firebaseService.getGeminiApiKey();
      this.logger.log(`🔑 Đang sử dụng Key: ${apiKeyConfig.name}`);
      const ai = new GoogleGenAI({ apiKey: apiKeyConfig.key });

      // 2. Gửi yêu cầu API với công cụ tìm kiếm Google
      const response = await ai.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
        config: {
          // Thêm công cụ tìm kiếm Google vào cấu hình
          tools: [{ googleSearch: {} }],
        },
      } as any);

      this.logger.log('✅ Received response from AI');

      // 3. Kiểm tra xem response có chứa groundingMetadata không
      if (
        response.candidates &&
        response.candidates[0] &&
        response.candidates[0].groundingMetadata
      ) {
        this.logger.log('✅ Google Search tool is ACTIVE');
      } else {
        this.logger.warn('⚠️  Google Search tool might not be active');
      }

      // 4. Trả về văn bản kết quả
      if (
        response.candidates &&
        response.candidates[0] &&
        response.candidates[0].content &&
        response.candidates[0].content.parts &&
        response.candidates[0].content.parts[0]
      ) {
        const answer = response.candidates[0].content.parts[0].text || '';
        this.logger.log('✅ Successfully extracted answer from response');
        return answer;
      }

      this.logger.warn('⚠️  No answer found in response');
      return '';
    } catch (error) {
      this.logger.error('❌ Error calling Gemini API:', error);
      throw new Error('Lỗi khi gọi API AI để xử lý câu hỏi.');
    }
  }

  /**
   * Thực hiện truy vấn AI, kết hợp RAG (tài liệu nội bộ) và trả lời câu hỏi.
   * @param userQuestion Câu hỏi của người dùng
   * @returns Câu trả lời từ AI
   */
  async sortPesticides(userQuestion: string): Promise<string> {
    // 1. Tạo Prompt cuối cùng với dữ liệu RAG
    const finalPrompt = `
      Hãy sử dụng tài liệu hướng dẫn phối trộn thuốc Bảo Vệ Thực Vật sau đây để trả lời câu hỏi.
      Nếu thông tin trong tài liệu không đủ, hãy sử dụng công cụ tìm kiếm Google để tìm kiếm thông tin bổ sung và trả lời câu hỏi.

      --- TÀI LIỆU NỀN TẢNG ---
      ${PESTICIDE_MIXING_DOCUMENT_TEXT}
      --- KẾT THÚC TÀI LIỆU ---

      --- CÁC LIÊN KẾT THAM KHẢO ---
      ${PESTICIDE_MIXING_REFERENCE_LINKS.map((link) => `- ${link}`).join('\n')}
      --- KẾT THÚC LIÊN KẾT ---

      Câu hỏi cần trả lời: ${userQuestion}
      - Luôn đọc kỹ, phân tích tài liệu và nguồn dữ liệu trước khi trả lời câu hỏi.
      - Hãy trả lời bằng tiếng Việt dựa trên tài liệu được cung cấp.
      - Nếu bạn cần tìm kiếm thông tin từ các liên kết hoặc sử dụng công cụ tìm kiếm, hãy thực hiện việc đó để cung cấp câu trả lời chính xác nhất.
      - Cố gắng trả lời và giải thích ngắn gọn tập trung vào câu hỏi thôi, để nông dân việt dễ hiểu không dùng các từ tiếng anh và từ viết tắt.
    `;

    try {
      this.logger.log('🚀 Starting AI processing with Google Search tool...');

      // Lấy API Key từ Firebase Remote Config (Cơ chế xoay vòng Key)
      const apiKeyConfig = await this.firebaseService.getGeminiApiKey();
      this.logger.log(`🔑 Đang sử dụng Key: ${apiKeyConfig.name}`);
      const ai = new GoogleGenAI({ apiKey: apiKeyConfig.key });

      // 2. Gửi yêu cầu API với công cụ tìm kiếm Google
      const response = await ai.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
        config: {
          // Thêm công cụ tìm kiếm Google vào cấu hình
          tools: [{ googleSearch: {} }],
        },
      } as any);

      this.logger.log('✅ Received response from AI');

      // 3. Kiểm tra xem response có chứa groundingMetadata không
      if (
        response.candidates &&
        response.candidates[0] &&
        response.candidates[0].groundingMetadata
      ) {
        this.logger.log('✅ Google Search tool is ACTIVE');
      } else {
        this.logger.warn('⚠️  Google Search tool might not be active');
      }

      // 4. Trả về văn bản kết quả
      if (
        response.candidates &&
        response.candidates[0] &&
        response.candidates[0].content &&
        response.candidates[0].content.parts &&
        response.candidates[0].content.parts[0]
      ) {
        const answer = response.candidates[0].content.parts[0].text || '';
        this.logger.log('✅ Successfully extracted answer from response');
        return answer;
      }

      this.logger.warn('⚠️  No answer found in response');
      return '';
    } catch (error) {
      this.logger.error('❌ Error calling Gemini API:', error);
      throw new Error('Lỗi khi gọi API AI để xử lý câu hỏi.');
    }
  }
}
