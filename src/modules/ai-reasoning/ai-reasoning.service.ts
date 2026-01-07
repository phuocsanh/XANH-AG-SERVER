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
Bạn là chuyên gia nông nghiệp AI. Phân tích nguy cơ ${diseaseName} tại ${locationName} dựa trên dự báo thời tiết 7 ngày tới.

THÔNG TIN BỆNH:
${additionalContext}

DỮ LIỆU THỜI TIẾT (Đã tổng hợp):
${JSON.stringify(simplifiedWeather, null, 2)}

YÊU CẦU:
1. Đánh giá mức độ nguy cơ (THẤP, TRUNG BÌNH, CAO, RẤT CAO) dựa trên điều kiện thời tiết và đặc điểm bệnh.
2. Xác định những ngày có nguy cơ cao nhất (peak_days).
3. Đưa ra phân tích chi tiết nhưng NGẮN GỌN, SÚC TÍCH (không quá 500 từ).
4. Đưa ra khuyến nghị cụ thể cho nông dân.

QUAN TRỌNG: 
- Chỉ trả về JSON object hợp lệ, KHÔNG có bất kỳ văn bản nào khác.
- KHÔNG thêm lời chào, giải thích, hoặc markdown code blocks.
- Chỉ trả về đúng JSON theo schema dưới đây:

{
  "risk_level": "string",
  "risk_score": number,
  "peak_days": "string",
  "summary": "string",
  "detailed_analysis": "string",
  "recommendations": "string",
  "daily_risks": [
    {
      "date": "string",
      "risk_score": number,
      "risk_level": "string",
      "main_factors": ["string"]
    }
  ]
}
`;

    const maxRetries = 3;
    let apiKeyConfig: { key: string; name: string } | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Tự động lấy API Key từ Firebase Remote Config
        apiKeyConfig = await this.firebaseService.getGeminiApiKey();
        const apiKey = apiKeyConfig.key;
        
        const modelName = this.configService.get<string>('GOOGLE_AI_MODEL') || 'gemini-1.5-flash';
        
        if (attempt === 1) {
          this.logger.log(`🔑 Đang sử dụng Key: ${apiKeyConfig.name} (${apiKey.substring(0, 10)}...)`);
        } else {
          this.logger.warn(`🔄 Thử lại lần ${attempt}/${maxRetries} cho Key: ${apiKeyConfig.name}`);
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMsg = JSON.stringify(errorData);
          
          if (response.status === 503 || errorMsg.includes('overloaded') || errorMsg.includes('503')) {
            this.logger.warn(`⚠️ Hệ thống bận (503) cho Key ${apiKeyConfig.name}.`);
            if (attempt < maxRetries) {
              const delay = attempt * 1500; // 1.5s, 3s
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }
          throw new Error(`Gemini API error: ${errorMsg}`);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!responseText) {
          this.logger.warn('⚠️ AI trả về phản hồi trống.');
          if (attempt < maxRetries) continue;
          throw new Error('AI returned empty response');
        }

        // Parse JSON response (đã được đảm bảo là JSON bởi responseMimeType)
        try {
          const analysis: AiAnalysisResult = JSON.parse(responseText);
          
          this.logger.log(`✅ Phân tích AI hoàn tất: ${analysis.risk_level} (${analysis.risk_score}/100)`);
          return analysis;
        } catch (parseError) {
          this.logger.error(`❌ Parse Error. Raw response: ${responseText.substring(0, 300)}...`);
          if (attempt < maxRetries) {
            continue; // Retry
          }
          throw new Error('Failed to parse AI response as JSON');
        }

      } catch (error: any) {
        const keyInfo = apiKeyConfig ? apiKeyConfig.name : 'Unknown';
        this.logger.error(`❌ Lỗi lần ${attempt} (${keyInfo}): ${error.message}`);
        
        if (attempt === maxRetries) {
          this.logger.error(`❌ Đã thử ${maxRetries} lần nhưng vẫn thất bại. Dùng kết quả dự phòng.`);
          return this.getFallbackResult(diseaseName);
        }
        
        // Chờ trước khi thử lại
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return this.getFallbackResult(diseaseName);
  }

  /**
   * Giảm tải dữ liệu thời tiết
   */
  private simplifyWeatherData(weatherData: WeatherData): any {
    const hourly = weatherData.hourly;
    const days: any[] = [];
    
    for (let i = 0; i < 7; i++) {
      const startIdx = i * 24;
      if (!hourly.time[startIdx]) continue;
      
      const date = hourly.time[startIdx].split('T')[0];
      const dailyTemps = hourly.temperature_2m.slice(startIdx, startIdx + 24);
      const dailyHumid = hourly.relative_humidity_2m.slice(startIdx, startIdx + 24);
      const dailyRainProb = hourly.precipitation_probability.slice(startIdx, startIdx + 24);
      const dailyRain = hourly.precipitation.slice(startIdx, startIdx + 24);

      let reliableRainHours = 0;
      let reliableRainTotal = 0;
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
        max_rain_prob: Math.max(...dailyRainProb)
      });
    }
    return days;
  }

  private getFallbackResult(diseaseName: string): AiAnalysisResult {
    return {
      risk_level: 'TRUNG BÌNH',
      risk_score: 50,
      peak_days: 'Đang cập nhật',
      summary: `Hệ thống bận hoặc lỗi kết nối AI. Đang hiển thị mức cảnh báo mặc định cho ${diseaseName}.`,
      detailed_analysis: 'Không thể phân tích chi tiết vào lúc này. Vui lòng thử lại sau.',
      recommendations: 'Vui lòng kiểm tra đồng ruộng và theo dõi các bản tin thời tiết tiếp theo.',
      daily_risks: []
    };
  }
}
