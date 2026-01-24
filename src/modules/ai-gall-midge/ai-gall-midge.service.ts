import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GallMidgeWarning, GallMidgeDailyRiskData } from '../../entities/gall-midge-warning.entity';
import { LocationService } from '../location/location.service';
import { WeatherService } from '../location/weather.service';
import { AiReasoningService, WeatherData } from '../ai-reasoning/ai-reasoning.service';

@Injectable()
export class AiGallMidgeService {
  private readonly logger = new Logger(AiGallMidgeService.name);

  constructor(
    @InjectRepository(GallMidgeWarning)
    private warningRepository: Repository<GallMidgeWarning>,
    private locationService: LocationService,
    private weatherService: WeatherService,
    private aiReasoningService: AiReasoningService,
  ) {}

  async getWarning(): Promise<GallMidgeWarning> {
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

  async runAnalysis(): Promise<GallMidgeWarning> {
    this.logger.log('🦟 Bắt đầu phân tích Muỗi Hành (AI Powered)...');
    try {
      const location = await this.locationService.getLocation();
      const weatherData = await this.weatherService.fetchWeatherData(location.lat, location.lon);
      return this.runAnalysisWithWeatherData(weatherData);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi phân tích Muỗi Hành: ${err.message}`, err.stack);
      throw error;
    }
  }

  async runAnalysisWithWeatherData(weatherData: WeatherData): Promise<GallMidgeWarning> {
    try {
      const location = await this.locationService.getLocation();

      const aiResult = await this.aiReasoningService.analyzeDiseaseRisk(
        'Muỗi Hành (Gall Midge)',
        location.name,
        weatherData,
        'Muỗi hành hoạt động mạnh khi độ ẩm rất cao (>85%), trời âm u ít nắng, nhiệt độ mát mẻ 23-28°C. Giai đoạn nguy hiểm nhất là lúa đẻ nhánh.'
      );

      const basicStats = this.calculateBasicStats(weatherData);

      const dailyData: GallMidgeDailyRiskData[] = basicStats.map(stat => {
        const aiDay = aiResult.daily_risks.find(d => d.date === stat.dateIso);
        return {
          date: stat.date,
          dayOfWeek: stat.dayOfWeek,
          tempAvg: stat.tempAvg,
          humidityAvg: stat.humidityAvg,
          cloudAvg: stat.cloudAvg,
          riskScore: aiDay ? aiDay.risk_score : 0,
          riskLevel: aiDay ? aiDay.risk_level : 'THẤP',
          breakdown: {
            humidityScore: 0,
            cloudScore: 0,
            tempScore: 0,
          },
        };
      });

      const formattedPeakDays = this.formatPeakDays(aiResult.peak_days);

      const message = `
${this.getRiskEmoji(aiResult.risk_level)} CẢNH BÁO: ${aiResult.risk_level}
📍 ${location.name}

${aiResult.summary}

⚠️ Thời gian nguy cơ cao: ${formattedPeakDays}

🔍 PHÂN TÍCH CHI TIẾT:
${aiResult.detailed_analysis}

💊 KHUYẾN NGHỊ:
${aiResult.recommendations}
      `.trim();

      const warningData = {
        generated_at: new Date(),
        risk_level: aiResult.risk_level,
        message: message,
        peak_days: formattedPeakDays,
        daily_data: dailyData,
      };

      let warning = await this.warningRepository.findOne({ where: { id: 1 } });
      if (warning) {
        await this.warningRepository.update(1, warningData);
        warning = await this.warningRepository.findOne({ where: { id: 1 } });
      } else {
        warning = await this.warningRepository.save({ id: 1, ...warningData });
      }

      this.logger.log(`✅ Phân tích Muỗi Hành hoàn tất: ${aiResult.risk_level}`);
      return warning!;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi phân tích Muỗi Hành: ${err.message}`, err.stack);
      throw error;
    }
  }

  // Method fetchWeatherData() đã được xóa - sử dụng WeatherService chung

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
      const clouds = hourly.cloud_cover.slice(startIdx, startIdx + 24);

      // Logic mưa thông minh
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
        cloudAvg: this.average(clouds),
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

  private formatPeakDays(peakDays: string): string {
    if (!peakDays || peakDays === 'Đang cập nhật') return peakDays;
    const isoDateRegex = /\d{4}-\d{2}-\d{2}/g;
    const matches = peakDays.match(isoDateRegex);
    if (!matches) return peakDays;
    let formatted = peakDays;
    matches.forEach(isoDate => {
      const [year, month, day] = isoDate.split('-');
      formatted = formatted.replace(isoDate, `${day}-${month}-${year}`);
    });
    return formatted;
  }
}
