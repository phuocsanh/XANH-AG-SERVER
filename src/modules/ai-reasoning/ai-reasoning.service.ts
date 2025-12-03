import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

export interface WeatherData {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    dew_point_2m: number[];
    precipitation: number[];
    precipitation_probability: number[];
    rain: number[];
    showers: number[];
    weather_code: number[];
    cloud_cover: number[];
    visibility: number[];
    wind_speed_10m: number[];
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

export interface AiAnalysisResult {
  risk_level: 'THẤP' | 'TRUNG BÌNH' | 'CAO' | 'RẤT CAO';
  risk_score: number; // 0-100
  peak_days: string; // VD: "05/12 - 07/12"
  summary: string; // Tóm tắt ngắn gọn
  detailed_analysis: string; // Phân tích chi tiết
  recommendations: string; // Khuyến nghị hành động
  daily_risks: {
    date: string;
    risk_score: number;
    risk_level: string;
    main_factors: string[]; // Các yếu tố chính gây nguy cơ (VD: "Mưa lớn", "Độ ẩm cao")
  }[];
}

@Injectable()
export class AiReasoningService {
  private readonly logger = new Logger(AiReasoningService.name);
  private readonly genAI: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not defined');
    }
    this.genAI = new GoogleGenAI({ apiKey });
  }

  /**
   * Phân tích nguy cơ sâu bệnh dựa trên dữ liệu thời tiết
   */
  async analyzeDiseaseRisk(
    diseaseName: string,
    locationName: string,
    weatherData: WeatherData,
    additionalContext?: string,
  ): Promise<AiAnalysisResult> {
    this.logger.log(`🤖 Đang phân tích AI cho bệnh: ${diseaseName} tại ${locationName}`);

    // Chuẩn bị dữ liệu thời tiết gọn nhẹ hơn để gửi cho AI (giảm token)
    const simplifiedWeather = this.simplifyWeatherData(weatherData);

    const prompt = `
Bạn là một chuyên gia nông nghiệp hàng đầu về lúa và bệnh học cây trồng.
Nhiệm vụ: Phân tích nguy cơ bùng phát **${diseaseName}** tại **${locationName}** trong 7 ngày tới.

DỮ LIỆU THỜI TIẾT DỰ BÁO (7 NGÀY TỚI):
${JSON.stringify(simplifiedWeather, null, 2)}

${additionalContext ? `THÔNG TIN BỔ SUNG:\n${additionalContext}\n` : ''}

YÊU CẦU PHÂN TÍCH:
1. Hãy suy luận dựa trên sự kết hợp của các yếu tố: Nhiệt độ, Độ ẩm, Lượng mưa, Xác suất mưa, Gió, Sương mù (dựa vào weather_code).
2. LƯU Ý QUAN TRỌNG: Chỉ tính là có mưa khi xác suất mưa (precipitation_probability) >= 50% và lượng mưa > 0.1mm. Đừng bị lừa bởi các cơn mưa xác suất thấp.
3. Đánh giá rủi ro tổng thể và rủi ro từng ngày.

HÃY TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON (Không Markdown, chỉ JSON thuần túy) theo cấu trúc sau:
{
  "risk_level": "THẤP" | "TRUNG BÌNH" | "CAO" | "RẤT CAO",
  "risk_score": number (0-100),
  "peak_days": "string (VD: 05/12 - 07/12)",
  "summary": "string (Tóm tắt ngắn gọn tình hình)",
  "detailed_analysis": "string (Phân tích chi tiết logic suy luận của bạn)",
  "recommendations": "string (Khuyến nghị cụ thể cho nông dân: thăm đồng, phun thuốc, loại thuốc gợi ý...)",
  "daily_risks": [
    {
      "date": "YYYY-MM-DD",
      "risk_score": number (0-100),
      "risk_level": "string",
      "main_factors": ["string"]
    }
  ]
}
`;

    try {
      const model = this.configService.get<string>('GOOGLE_AI_MODEL') || 'gemini-1.5-flash';
      
      const result = await this.genAI.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        }
      });
      
      const responseText = result.text || '';
      
      // Clean up JSON string (remove markdown code blocks if any)
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const analysis: AiAnalysisResult = JSON.parse(cleanJson);
      
      this.logger.log(`✅ Phân tích AI hoàn tất: ${analysis.risk_level} (${analysis.risk_score}/100)`);
      return analysis;

    } catch (error) {
      this.logger.error(`❌ Lỗi khi gọi Gemini AI: ${error}`);
      // Fallback an toàn nếu AI lỗi
      return this.getFallbackResult(diseaseName);
    }
  }

  /**
   * Giảm tải dữ liệu gửi đi để tiết kiệm token và giúp AI tập trung
   * Chuyển từ Hourly -> 4 mốc thời gian quan trọng trong ngày (Sáng, Trưa, Chiều, Tối)
   */
  private simplifyWeatherData(weatherData: WeatherData): any {
    const hourly = weatherData.hourly;
    const days: any[] = [];
    
    // Lấy 7 ngày
    for (let i = 0; i < 7; i++) {
      const startIdx = i * 24;
      const date = hourly.time[startIdx]?.split('T')[0];
      if (!date) continue;
      
      // Lấy số liệu tổng hợp trong ngày
      const dailyTemps = hourly.temperature_2m.slice(startIdx, startIdx + 24);
      const dailyHumid = hourly.relative_humidity_2m.slice(startIdx, startIdx + 24);
      const dailyRainProb = hourly.precipitation_probability.slice(startIdx, startIdx + 24);
      const dailyRain = hourly.precipitation.slice(startIdx, startIdx + 24);

      // Tính toán thông minh: Chỉ tính mưa khi xác suất > 50%
      let reliableRainTotal = 0;
      let reliableRainHours = 0;
      
      for (let h = 0; h < 24; h++) {
        if ((dailyRainProb[h] ?? 0) >= 50 && (dailyRain[h] ?? 0) > 0.1) {
          reliableRainTotal += dailyRain[h] ?? 0;
          reliableRainHours++;
        }
      }

      days.push({
        date: date,
        temp_min: Math.min(...dailyTemps),
        temp_max: Math.max(...dailyTemps),
        humidity_avg: Math.round(dailyHumid.reduce((a, b) => a + b, 0) / 24),
        humidity_max: Math.max(...dailyHumid),
        rain_total_mm: Math.round(reliableRainTotal * 10) / 10,
        rain_hours: reliableRainHours,
        max_rain_prob: Math.max(...dailyRainProb),
        // Lấy mẫu 4 thời điểm: 0h, 6h, 12h, 18h
        samples: {
          morning_6h: { temp: hourly.temperature_2m[startIdx + 6], humid: hourly.relative_humidity_2m[startIdx + 6] },
          noon_12h: { temp: hourly.temperature_2m[startIdx + 12], humid: hourly.relative_humidity_2m[startIdx + 12] },
          evening_18h: { temp: hourly.temperature_2m[startIdx + 18], humid: hourly.relative_humidity_2m[startIdx + 18] },
          night_0h: { temp: hourly.temperature_2m[startIdx], humid: hourly.relative_humidity_2m[startIdx] }
        }
      });
    }
    return days;
  }

  private getFallbackResult(diseaseName: string): AiAnalysisResult {
    return {
      risk_level: 'TRUNG BÌNH',
      risk_score: 50,
      peak_days: 'Đang cập nhật',
      summary: `Hệ thống đang gặp sự cố kết nối AI. Đang hiển thị mức cảnh báo mặc định cho ${diseaseName}.`,
      detailed_analysis: 'Không thể phân tích chi tiết do lỗi kết nối.',
      recommendations: 'Vui lòng theo dõi đồng ruộng thường xuyên.',
      daily_risks: []
    };
  }
}
