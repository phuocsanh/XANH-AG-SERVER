import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StemBorerWarning, StemBorerDailyRiskData } from '../../entities/stem-borer-warning.entity';
import { LocationService } from '../location/location.service';
import { WeatherService, WeatherData } from '../location/weather.service';

@Injectable()
export class AiStemBorerService {
  private readonly logger = new Logger(AiStemBorerService.name);

  constructor(
    @InjectRepository(StemBorerWarning)
    private warningRepository: Repository<StemBorerWarning>,
    private locationService: LocationService,
    private weatherService: WeatherService,
  ) {}

  async getWarning(): Promise<StemBorerWarning> {
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

  async runAnalysis(): Promise<StemBorerWarning> {
    this.logger.log('🐛 Bắt đầu phân tích Sâu Đục Thân...');
    try {
      const location = await this.locationService.getLocation();
      const weatherData = await this.weatherService.fetchWeatherData(location.lat, location.lon);
      return this.runAnalysisWithWeatherData(weatherData);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi phân tích Sâu Đục Thân: ${err.message}`, err.stack);
      throw error;
    }
  }

  async runAnalysisWithWeatherData(weatherData: WeatherData): Promise<StemBorerWarning> {
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
      this.logger.log(`✅ Phân tích Sâu Đục Thân hoàn tất: ${analysis.riskLevel}`);
      return warning;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi phân tích Sâu Đục Thân: ${err.message}`, err.stack);
      throw error;
    }
  }

  private calculateDailyRisk(weatherData: WeatherData): StemBorerDailyRiskData[] {
    const hourly = weatherData.hourly;
    const dailyData: StemBorerDailyRiskData[] = [];

    for (let day = 0; day < 7; day++) {
      const startIdx = day * 24;
      const endIdx = startIdx + 24;

      const temps = hourly.temperature_2m.slice(startIdx, endIdx);
      const humidities = hourly.relative_humidity_2m.slice(startIdx, endIdx);
      const clouds = hourly.cloud_cover.slice(startIdx, endIdx);

      const tempAvg = this.average(temps);
      const humidityAvg = this.average(humidities);
      const cloudAvg = this.average(clouds);
      const sunHours = Math.round(((100 - cloudAvg) / 100) * 12 * 10) / 10;

      // --- LOGIC TÍNH ĐIỂM SÂU ĐỤC THÂN ---
      // 1. Nhiệt độ: 25-30°C là lý tưởng (40đ)
      let tempScore = 0;
      if (tempAvg >= 25 && tempAvg <= 30) tempScore = 40;
      else if (tempAvg >= 22 && tempAvg < 25) tempScore = 20;

      // 2. Độ ẩm: > 80% (30đ)
      let humidityScore = 0;
      if (humidityAvg >= 80) humidityScore = 30;
      else if (humidityAvg >= 75) humidityScore = 15;

      // 3. Nắng: Nắng ấm xen kẽ mưa (30đ)
      let sunScore = 0;
      if (sunHours >= 4) sunScore = 30;
      else if (sunHours >= 2) sunScore = 15;

      const riskScore = tempScore + humidityScore + sunScore;

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
        sunHours,
        riskScore,
        riskLevel,
        breakdown: { tempScore, humidityScore, sunScore },
      });
    }
    return dailyData;
  }

  private analyzeRiskLevel(dailyData: StemBorerDailyRiskData[]): { riskLevel: string; peakDays: string; highRiskDays: string[] } {
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
      msg += `🐛 SÂU ĐỤC THÂN: NGUY CƠ CAO\n`;
      msg += `⚠️ Các ngày nguy cơ cao: ${highRiskDays.join(', ')}\n`;
      msg += `⚠️ Thời tiết ấm ẩm, thuận lợi bướm đẻ trứng.\n`;
      msg += `👉 Khuyến cáo: Thăm đồng, kiểm tra mật độ bướm. Phun thuốc nếu bướm rộ.\n`;
      msg += `⏰ Thời điểm phun: Chiều tối 17:00-19:00 hoặc Sáng sớm 5:00-7:00 (khi bướm hoạt động).`;
    } else if (riskLevel === 'TRUNG BÌNH') {
      msg += `🐛 Sâu đục thân: Nguy cơ Trung bình\n`;
      if (highRiskDays.length > 0) msg += `⚠️ Các ngày cần chú ý: ${highRiskDays.join(', ')}\n`;
      msg += `⚠️ Cần theo dõi thêm.\n`;
    } else {
      msg += `✅ Sâu đục thân: An toàn\n`;
      msg += `Thời tiết chưa thuận lợi cho sâu phát triển.`;
    }
    return msg;
  }

  private average(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}
