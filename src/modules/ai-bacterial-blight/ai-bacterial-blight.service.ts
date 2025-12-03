import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BacterialBlightWarning, BacterialBlightDailyRiskData } from '../../entities/bacterial-blight-warning.entity';
import { LocationService } from '../location/location.service';
import { AiReasoningService, WeatherData } from '../ai-reasoning/ai-reasoning.service';
import axios from 'axios';
import * as https from 'https';

@Injectable()
export class AiBacterialBlightService {
  private readonly logger = new Logger(AiBacterialBlightService.name);

  constructor(
    @InjectRepository(BacterialBlightWarning)
    private warningRepository: Repository<BacterialBlightWarning>,
    private locationService: LocationService,
    private aiReasoningService: AiReasoningService,
  ) {}

  async getWarning(): Promise<BacterialBlightWarning> {
    const warning = await this.warningRepository.findOne({ where: { id: 1 } });
    if (!warning) {
      return this.warningRepository.save({
        id: 1,
        generated_at: new Date(),
        risk_level: 'ĐANG CHỜ CẬP NHẬT',
        message: 'Hệ thống đang khởi động. Vui lòng chờ phân tích tự động hoặc bấm "Chạy ngay".',
        peak_days: null,
        daily_data: [],
      });
    }
    return warning;
  }

  async runAnalysis(): Promise<BacterialBlightWarning> {
    this.logger.log('🔬 Bắt đầu phân tích bệnh cháy bìa lá (AI Powered)...');
    try {
      const location = await this.locationService.getLocation();
      const weatherData = await this.fetchWeatherData(location.lat, location.lon);
      return this.runAnalysisWithWeatherData(weatherData);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi khi phân tích: ${err.message}`, err.stack);
      throw error;
    }
  }

  async runAnalysisWithWeatherData(weatherData: WeatherData): Promise<BacterialBlightWarning> {
    try {
      const location = await this.locationService.getLocation();

      // 1. Gọi AI để phân tích rủi ro
      const aiResult = await this.aiReasoningService.analyzeDiseaseRisk(
        'Bệnh Cháy Bìa Lá (Bacterial Blight)',
        location.name,
        weatherData,
        'Bệnh phát triển mạnh khi có mưa to kèm gió lớn (làm rách lá tạo vết thương cho vi khuẩn xâm nhập). Nhiệt độ 26-30 độ C và độ ẩm cao là điều kiện thuận lợi.'
      );

      // 2. Tính toán số liệu thống kê cơ bản
      const basicStats = this.calculateBasicStats(weatherData);

      // 3. Merge kết quả AI vào dữ liệu ngày
      const dailyData: BacterialBlightDailyRiskData[] = basicStats.map(stat => {
        const aiDay = aiResult.daily_risks.find(d => d.date === stat.dateIso);
        return {
          date: stat.date,
          dayOfWeek: stat.dayOfWeek,
          tempMin: stat.tempMin,
          tempMax: stat.tempMax,
          tempAvg: stat.tempAvg,
          humidityAvg: stat.humidityAvg,
          rainTotal: stat.rainTotal,
          rainHours: stat.rainHours,
          windSpeedMax: stat.windSpeedMax,
          windSpeedAvg: stat.windSpeedAvg,
          rain3Days: stat.rain3Days,
          riskScore: aiDay ? aiDay.risk_score : 0,
          riskLevel: aiDay ? aiDay.risk_level : 'THẤP',
          breakdown: {
            tempScore: 0,
            rainScore: 0,
            windScore: 0,
            humidityScore: 0,
            floodScore: 0,
          },
        };
      });

      // 4. Tạo nội dung cảnh báo từ AI
      const message = `
${this.getRiskEmoji(aiResult.risk_level)} CẢNH BÁO: ${aiResult.risk_level}
📍 ${location.name}

${aiResult.summary}

⚠️ Thời gian nguy cơ cao: ${aiResult.peak_days}

🔍 PHÂN TÍCH CHI TIẾT:
${aiResult.detailed_analysis}

💊 KHUYẾN NGHỊ:
${aiResult.recommendations}
      `.trim();

      // 5. Lưu vào database
      const warningData = {
        generated_at: new Date(),
        risk_level: aiResult.risk_level,
        message: message,
        peak_days: aiResult.peak_days,
        daily_data: dailyData,
      };

      let warning = await this.warningRepository.findOne({ where: { id: 1 } });
      if (warning) {
        await this.warningRepository.update(1, warningData);
        warning = await this.warningRepository.findOne({ where: { id: 1 } });
      } else {
        warning = await this.warningRepository.save({ id: 1, ...warningData });
      }

      this.logger.log(`✅ Phân tích AI hoàn tất: ${aiResult.risk_level}`);
      return warning!;

    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi khi phân tích: ${err.message}`, err.stack);
      throw error;
    }
  }

  private async fetchWeatherData(lat: number, lon: number): Promise<WeatherData> {
    const url = 'https://api.open-meteo.com/v1/forecast';
    const params = {
      latitude: lat,
      longitude: lon,
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'precipitation',
        'precipitation_probability',
        'wind_speed_10m',
        'weather_code',
        'cloud_cover',
        'visibility',
        'rain',
        'showers',
        'dew_point_2m'
      ].join(','),
      forecast_days: 7,
      timezone: 'Asia/Ho_Chi_Minh',
    };

    try {
      const agent = new https.Agent({ family: 4 });
      const response = await axios.get(url, { params, timeout: 10000, httpsAgent: agent });
      return response.data;
    } catch (error) {
      this.logger.error(`❌ Lỗi kết nối Open-Meteo: ${error}`);
      throw new Error('Lỗi kết nối API thời tiết.');
    }
  }

  private calculateBasicStats(weatherData: WeatherData): any[] {
    const hourly = weatherData.hourly;
    const stats: any[] = [];
    
    for (let day = 0; day < 7; day++) {
      const startIdx = day * 24;
      const endIdx = startIdx + 24;
      
      const temps = hourly.temperature_2m.slice(startIdx, endIdx);
      const humidities = hourly.relative_humidity_2m.slice(startIdx, endIdx);
      const rains = hourly.precipitation.slice(startIdx, endIdx);
      const rainProbs = hourly.precipitation_probability.slice(startIdx, endIdx);
      const winds = hourly.wind_speed_10m.slice(startIdx, endIdx);

      // Logic mưa thông minh
      let rainTotal = 0;
      let rainHours = 0;
      for (let i = 0; i < 24; i++) {
        if ((rainProbs[i] ?? 0) >= 50 && (rains[i] ?? 0) > 0.1) {
          rainTotal += rains[i] ?? 0;
          rainHours++;
        }
      }

      // Tính mưa 3 ngày (để tính ngập úng)
      let rain3Days = rainTotal;
      // Lưu ý: Logic tính mưa 3 ngày ở đây chỉ tính đơn giản trong phạm vi 7 ngày dự báo
      // Nếu muốn chính xác cần data quá khứ, nhưng tạm thời chấp nhận
      if (day >= 1 && stats[day - 1]) rain3Days += stats[day - 1].rainTotal;
      if (day >= 2 && stats[day - 2]) rain3Days += stats[day - 2].rainTotal;

      const dateStr = hourly.time[startIdx]?.split('T')[0] || '';
      const date = new Date(dateStr);
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const dayOfWeek = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()] || 'CN';

      stats.push({
        dateIso: dateStr,
        date: formattedDate,
        dayOfWeek,
        tempMin: Math.min(...temps),
        tempMax: Math.max(...temps),
        tempAvg: this.average(temps),
        humidityAvg: this.average(humidities),
        rainTotal: Math.round(rainTotal * 10) / 10,
        rainHours,
        windSpeedMax: Math.max(...winds),
        windSpeedAvg: this.average(winds),
        rain3Days: Math.round(rain3Days * 10) / 10,
      });
    }
    return stats;
  }

  private average(arr: number[]): number {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  private getRiskEmoji(level: string): string {
    switch (level) {
      case 'RẤT CAO': return '🔴';
      case 'CAO': return '🟠';
      case 'TRUNG BÌNH': return '🟡';
      default: return '🟢';
    }
  }
}
