import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { PESTICIDE_MIXING_DOCUMENT_TEXT } from './data/pesticide-mixing.data';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiDocumentService {
  private ai: GoogleGenAI;
  private readonly model = 'gemini-1.5-flash';

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not found in environment variables.');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Thực hiện truy vấn AI, kết hợp RAG (tài liệu nội bộ) và trả lời câu hỏi.
   * @param userQuestion Câu hỏi của người dùng
   * @returns Câu trả lời từ AI
   */
  async getDocumentAnswer(userQuestion: string): Promise<string> {
    // 1. Tạo Prompt cuối cùng với dữ liệu RAG
    const finalPrompt = `
      Bạn là chuyên gia nông nghiệp. Hãy sử dụng tài liệu hướng dẫn phối trộn thuốc BVTV sau đây để trả lời câu hỏi.

      --- TÀI LIỆU NỀN TẢNG ---
      ${PESTICIDE_MIXING_DOCUMENT_TEXT}
      --- KẾT THÚC TÀI LIỆU ---

      Câu hỏi cần trả lời: ${userQuestion}
      
      Hãy trả lời bằng tiếng Việt và cung cấp thông tin chi tiết, cụ thể dựa trên tài liệu được cung cấp.
    `;

    try {
      // 2. Gửi yêu cầu API
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
      });

      // 3. Trả về văn bản kết quả
      return response.text || '';
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw new Error('Lỗi khi gọi API AI để xử lý câu hỏi.');
    }
  }
}
