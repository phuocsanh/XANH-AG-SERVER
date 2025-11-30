import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GallMidgeWarning, GallMidgeDailyRiskData } from '../../entities/gall-midge-warning.entity';
import { LocationService } from '../location/location.service';
import { WeatherService, WeatherData } from '../location/weather.service';

@Injectable()
export class AiGallMidgeService {
  private readonly logger = new Logger(AiGallMidgeService.name);

  constructor(
    @InjectRepository(GallMidgeWarning)
    private warningRepository: Repository<GallMidgeWarning>,
    private locationService: LocationService,
    private weatherService: WeatherService,
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
    this.logger.log('🦟 Bắt đầu phân tích Muỗi Hành...');
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
      const dailyData = this.calculateDailyRisk(weatherData);
      const analysis = this.analyzeRiskLevel(dailyData);
      const message = this.generateWarningMessage(analysis, location.name);

      const warningData = {
        generated_at: new Date(),
        risk_level: analysis.riskLevel,
        message: message,
        peak_days: analysis.peakDays,
        daily_data: dailyData,
      };

      let warning = await this.warningRepository.findOne({ where: { id: 1 } });
      if (warning) {
        await this.warningRepository.update(1, warningData);
        warning = await this.warningRepository.findOne({ where: { id: 1 } });
      } else {
        warning = await this.warningRepository.save({ id: 1, ...warningData });
      }

      if (!warning) throw new Error('Failed to save warning');
      this.logger.log(`✅ Phân tích Muỗi Hành hoàn tất: ${analysis.riskLevel}`);
      return warning;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi phân tích Muỗi Hành: ${err.message}`, err.stack);
      throw error;
    }
  }

  private calculateDailyRisk(weatherData: WeatherData): GallMidgeDailyRiskData[] {
    const hourly = weatherData.hourly;
    const dailyData: GallMidgeDailyRiskData[] = [];

    for (let day = 0; day < 7; day++) {
      const startIdx = day * 24;
      const endIdx = startIdx + 24;

      const temps = hourly.temperature_2m.slice(startIdx, endIdx);
      const humidities = hourly.relative_humidity_2m.slice(startIdx, endIdx);
      const clouds = hourly.cloud_cover.slice(startIdx, endIdx);

      const tempAvg = this.average(temps);
      const humidityAvg = this.average(humidities);
      const cloudAvg = this.average(clouds);

      // --- LOGIC TÍNH ĐIỂM MUỖI HÀNH ---
      // 1. Độ ẩm: > 85% (Rất quan trọng) (50đ)
      let humidityScore = 0;
      if (humidityAvg >= 90) humidityScore = 50;
      else if (humidityAvg >= 85) humidityScore = 40;

      // 2. Mây: Trời âm u, ít nắng (30đ)
      let cloudScore = 0;
      if (cloudAvg >= 70) cloudScore = 30; // Mây che phủ > 70%
      else if (cloudAvg >= 50) cloudScore = 15;

      // 3. Nhiệt độ: Mát mẻ 23-28°C (20đ)
      let tempScore = 0;
      if (tempAvg >= 23 && tempAvg <= 28) tempScore = 20;

      const riskScore = humidityScore + cloudScore + tempScore;

      let riskLevel = 'THẤP';
      if (riskScore >= 80) riskLevel = 'CAO';
      else if (riskScore >= 50) riskLevel = 'TRUNG BÌNH';

      const dateStr = hourly.time[startIdx]?.split('T')[0] || '';
      const date = new Date(dateStr);
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const dayOfWeek = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()] || 'CN';

      dailyData.push({
        date: formattedDate,
        dayOfWeek,
        tempAvg,
        humidityAvg,
        cloudAvg,
        riskScore,
        riskLevel,
        breakdown: { humidityScore, cloudScore, tempScore },
      });
    }
    return dailyData;
  }

  private analyzeRiskLevel(dailyData: GallMidgeDailyRiskData[]): { riskLevel: string; peakDays: string; highRiskDays: string[] } {
    const maxScore = Math.max(...dailyData.map(d => d.riskScore));
    let riskLevel = 'THẤP';
    if (maxScore >= 80) riskLevel = 'CAO';
    else if (maxScore >= 50) riskLevel = 'TRUNG BÌNH';

    const highRiskDays = dailyData.filter(d => d.riskScore >= 50).map(d => d.date);
    const peakDays = this.formatPeakDays(highRiskDays);
    return { riskLevel, peakDays, highRiskDays };
  }

  private formatPeakDays(days: string[]): string {
    if (days.length === 0) return '';
    if (days.length === 1) return days[0] || '';
    return `${days[0] || ''} – ${days[days.length - 1] || ''}`;
  }

  private generateWarningMessage(
    analysis: { riskLevel: string; highRiskDays: string[] },
    locationName: string,
  ): string {
    const { riskLevel, highRiskDays } = analysis;
    let msg = `📍 ${locationName}\n\n`;

    if (riskLevel === 'CAO') {
      msg += `🦟 MUỖI HÀNH: NGUY CƠ CAO\n`;
      msg += `⚠️ Các ngày nguy cơ cao: ${highRiskDays.join(', ')}\n`;
      msg += `⚠️ Độ ẩm cao, trời âm u sương mù.\n`;
      msg += `👉 Khuyến cáo: Phun phòng ngay bằng thuốc lưu dẫn nếu lúa đang đẻ nhánh.\n`;
      msg += `⏰ Thời điểm phun: Chiều mát 16:00-18:00 (trước khi muỗi hoạt động vào đêm).`;
    } else if (riskLevel === 'TRUNG BÌNH') {
      msg += `🦟 Muỗi hành: Nguy cơ Trung bình\n`;
      if (highRiskDays.length > 0) msg += `⚠️ Các ngày cần chú ý: ${highRiskDays.join(', ')}\n`;
      msg += `⚠️ Chú ý nếu trời tiếp tục âm u.`;
    } else {
      msg += `✅ Muỗi hành: An toàn\n`;
      msg += `Thời tiết khô ráo, nhiều nắng, không thuận lợi cho muỗi hành.`;
    }
    return msg;
  }

  private average(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}
