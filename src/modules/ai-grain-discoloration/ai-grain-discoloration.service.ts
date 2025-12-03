import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrainDiscolorationWarning, GrainDiscolorationDailyRiskData } from '../../entities/grain-discoloration-warning.entity';
import { LocationService } from '../location/location.service';
import { AiReasoningService, WeatherData } from '../ai-reasoning/ai-reasoning.service';
import axios from 'axios';
import * as https from 'https';

@Injectable()
export class AiGrainDiscolorationService {
  private readonly logger = new Logger(AiGrainDiscolorationService.name);

  constructor(
    @InjectRepository(GrainDiscolorationWarning)
    private warningRepository: Repository<GrainDiscolorationWarning>,
    private locationService: LocationService,
    private aiReasoningService: AiReasoningService,
  ) {}

  async getWarning(): Promise<GrainDiscolorationWarning> {
    const warning = await this.warningRepository.findOne({ where: { id: 1 } });
    if (!warning) {
      return this.warningRepository.save({
        id: 1,
        generated_at: new Date(),
        risk_level: 'ĐANG CHỜ CẬP NHẬT',
        message: 'Hệ thống đang khởi động...',
        peak_days: null,
        daily_data: [],
      });
    }
    return warning;
  }

  async runAnalysis(): Promise<GrainDiscolorationWarning> {
    this.logger.log('🌾 Bắt đầu phân tích Bệnh Lem Lép Hạt (AI Powered)...');
    try {
      const location = await this.locationService.getLocation();
      const weatherData = await this.fetchWeatherData(location.lat, location.lon);
      return this.runAnalysisWithWeatherData(weatherData);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi phân tích Bệnh Lem Lép Hạt: ${err.message}`, err.stack);
      throw error;
    }
  }

  async runAnalysisWithWeatherData(weatherData: WeatherData): Promise<GrainDiscolorationWarning> {
    try {
      const location = await this.locationService.getLocation();

      const aiResult = await this.aiReasoningService.analyzeDiseaseRisk(
        'Bệnh Lem Lép Hạt (Grain Discoloration)',
        location.name,
        weatherData,
        'Bệnh lem lép hạt phát triển mạnh khi trời mưa nhiều trong giai đoạn trỗ bông - chín. Nhiệt độ 25-30°C, độ ẩm cao >85% rất thuận lợi. Mưa kéo dài làm hạt bị nhiễm nấm, giảm chất lượng gạo.',
        7 // Key index
      );

      const basicStats = this.calculateBasicStats(weatherData);

      const dailyData: GrainDiscolorationDailyRiskData[] = basicStats.map(stat => {
        const aiDay = aiResult.daily_risks.find(d => d.date === stat.dateIso);
        return {
          date: stat.date,
          dayOfWeek: stat.dayOfWeek,
          tempAvg: stat.tempAvg,
          humidityAvg: stat.humidityAvg,
          rainTotal: stat.rainTotal,
          rainHours: stat.rainHours,
          windSpeedAvg: 0, // Không cần thiết cho AI analysis
          riskScore: aiDay ? aiDay.risk_score : 0,
          riskLevel: aiDay ? aiDay.risk_level : 'THẤP',
          breakdown: {
            humidityScore: 0,
            rainScore: 0,
            windScore: 0,
          },
        };
      });

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

      this.logger.log(`✅ Phân tích Bệnh Lem Lép Hạt hoàn tất: ${aiResult.risk_level}`);
      return warning!;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi phân tích Bệnh Đốm Hạt: ${err.message}`, err.stack);
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
      
      const temps = hourly.temperature_2m.slice(startIdx, startIdx + 24);
      const humidities = hourly.relative_humidity_2m.slice(startIdx, startIdx + 24);
      const rains = hourly.precipitation.slice(startIdx, startIdx + 24);
      const rainProbs = hourly.precipitation_probability.slice(startIdx, startIdx + 24);
      const dewPoints = hourly.dew_point_2m.slice(startIdx, startIdx + 24);

      let rainTotal = 0;
      let rainHours = 0;
      for (let i = 0; i < 24; i++) {
        if ((rainProbs[i] ?? 0) >= 50 && (rains[i] ?? 0) > 0.1) {
          rainTotal += rains[i] ?? 0;
          rainHours++;
        }
      }

      // LWD (Leaf Wetness Duration) - Thời gian lá ướt
      let lwdHours = 0;
      for (let i = 0; i < 24; i++) {
        const isWetByDew = (humidities[i] ?? 0) >= 90 && (temps[i] ?? 0) <= (dewPoints[i] ?? 0) + 1.0;
        const isWetByRain = (rainProbs[i] ?? 0) >= 50 && (rains[i] ?? 0) > 0.1;
        if (isWetByDew || isWetByRain) lwdHours++;
      }

      const dateStr = hourly.time[startIdx]?.split('T')[0] || '';
      const date = new Date(dateStr);
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const dayOfWeek = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()] || 'CN';

      stats.push({
        dateIso: dateStr,
        date: formattedDate,
        dayOfWeek,
        tempAvg: this.average(temps),
        humidityAvg: this.average(humidities),
        rainTotal: Math.round(rainTotal * 10) / 10,
        rainHours,
        lwdHours,
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
