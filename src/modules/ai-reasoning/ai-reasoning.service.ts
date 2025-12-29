import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from '../firebase/firebase.service';

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

  constructor(
    private readonly configService: ConfigService,
    private readonly firebaseService: FirebaseService,
  ) {}

  /**
   * Phân tích nguy cơ sâu bệnh dựa trên dữ liệu thời tiết
   * @param keyIndex Index của API key (1-7) để tránh rate limit
   */
  async analyzeDiseaseRisk(
    diseaseName: string,
    locationName: string,
    weatherData: WeatherData,
    additionalContext?: string,
    keyIndex: number = 1,
  ): Promise<AiAnalysisResult> {
    this.logger.log(`🤖 Đang phân tích AI cho bệnh: ${diseaseName} tại ${locationName} (Key #${keyIndex})`);

    // Chuẩn bị dữ liệu thời tiết gọn nhẹ hơn để gửi cho AI (giảm token)
    const simplifiedWeather = this.simplifyWeatherData(weatherData);

    const prompt = `
Bạn là chuyên gia nông nghiệp AI. Hãy phân tích nguy cơ ${diseaseName} tại ${locationName} dựa trên dự báo thời tiết 7 ngày tới.

THÔNG TIN BỆNH:
${additionalContext}

DỮ LIỆU THỜI TIẾT (Đã tổng hợp):
${JSON.stringify(simplifiedWeather, null, 2)}

        YÊU CẦU:
        1. Đánh giá mức độ nguy cơ (THẤP, TRUNG BÌNH, CAO, RẤT CAO) dựa trên điều kiện thời tiết và đặc điểm bệnh.
        2. Xác định những ngày có nguy cơ cao nhất (peak_days).
        3. Đưa ra phân tích chi tiết nhưng NGẮN GỌN, SÚC TÍCH (không quá 500 từ).
        4. Đưa ra khuyến nghị cụ thể cho nông dân.
        5. Trả về kết quả dưới dạng JSON hợp lệ theo schema.
      `;

    let apiKey = '';
    try {
      // Lấy API Key từ Firebase Remote Config hoặc .env (theo keyIndex)
      apiKey = await this.firebaseService.getGeminiApiKeyByIndex(keyIndex);
      
      const modelName = this.configService.get<string>('GOOGLE_AI_MODEL') || 'gemini-2.5-flash';
      
      // Gọi Gemini API trực tiếp qua REST
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
            responseMimeType: "application/json", // Bắt buộc trả về JSON
            responseSchema: {
              type: "object",
              properties: {
                risk_level: { type: "string", enum: ["THẤP", "TRUNG BÌNH", "CAO", "RẤT CAO"] },
                risk_score: { type: "number", minimum: 0, maximum: 100 },
                peak_days: { type: "string" },
                summary: { type: "string" },
                detailed_analysis: { type: "string" },
                recommendations: { type: "string" },
                daily_risks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string" },
                      risk_score: { type: "number" },
                      risk_level: { type: "string" },
                      main_factors: { type: "array", items: { type: "string" } }
                    },
                    required: ["date", "risk_score", "risk_level", "main_factors"]
                  }
                }
              },
              required: ["risk_level", "risk_score", "peak_days", "summary", "detailed_analysis", "recommendations", "daily_risks"]
            }
          },
          // Tắt bộ lọc an toàn để tránh block nhầm
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      
      // DEBUG: Log full response data nếu không tìm thấy text
      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
         this.logger.warn(`⚠️ Gemini Response Structure (Key #${keyIndex}): ${JSON.stringify(data)}`);
      }

      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // DEBUG: Log raw response (first 500 chars)
      this.logger.log(`📝 Raw AI Response (Key #${keyIndex}): ${responseText.substring(0, 500)}...`);

      // Clean up JSON string - Nhiều bước để đảm bảo parse thành công
      let cleanJson = responseText
        .replace(/```json\s*/g, '')  // Loại bỏ markdown code block
        .replace(/```\s*/g, '')       // Loại bỏ markdown closing
        .trim();
      
      // Tìm JSON object đầu tiên (từ { đến } cuối cùng)
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        this.logger.error(`❌ Không tìm thấy JSON object hợp lệ trong response`);
        throw new Error('AI response không chứa JSON object hợp lệ');
      }
      
      cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      
      if (!cleanJson) {
        throw new Error('AI returned empty response');
      }

      let analysis: AiAnalysisResult;
      try {
        analysis = JSON.parse(cleanJson);
      } catch (parseError: any) {
        // Log chi tiết để debug
        this.logger.error(`❌ Parse JSON Error at position ${parseError.message}`);
        this.logger.error(`📄 Cleaned JSON (first 1000 chars): ${cleanJson.substring(0, 1000)}`);
        throw new Error(`Lỗi parse JSON từ AI: ${parseError.message}`);
      }
      
      // DEBUG: Log structure của AI result
      this.logger.log(`📊 AI Result Keys: ${Object.keys(analysis).join(', ')}`);
      this.logger.log(`📊 Daily Risks Count: ${analysis.daily_risks?.length || 0}`);
      
      this.logger.log(`✅ Phân tích AI hoàn tất: ${analysis.risk_level} (${analysis.risk_score}/100)`);
      return analysis;

    } catch (error) {
      this.logger.error(`❌ Lỗi khi gọi Gemini AI (Key #${keyIndex}): ${error}`);
      this.logger.error(`🔑 Key đang dùng: ${apiKey}`); // Log key để kiểm tra
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
