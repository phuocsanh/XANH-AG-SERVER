import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SheathBlightWarning, SheathBlightDailyRiskData } from '../../entities/sheath-blight-warning.entity';
import { LocationService } from '../location/location.service';
import { WeatherService, WeatherData } from '../location/weather.service';

@Injectable()
export class AiSheathBlightService {
  private readonly logger = new Logger(AiSheathBlightService.name);

  constructor(
    @InjectRepository(SheathBlightWarning)
    private warningRepository: Repository<SheathBlightWarning>,
    private locationService: LocationService,
    private weatherService: WeatherService,
  ) {}

  async getWarning(): Promise<SheathBlightWarning> {
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

  async runAnalysis(): Promise<SheathBlightWarning> {
    this.logger.log('🍄 Bắt đầu phân tích Bệnh Khô Vằn...');
    try {
      const location = await this.locationService.getLocation();
      const weatherData = await this.weatherService.fetchWeatherData(location.lat, location.lon);
      return this.runAnalysisWithWeatherData(weatherData);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi phân tích Khô Vằn: ${err.message}`, err.stack);
      throw error;
    }
  }

  async runAnalysisWithWeatherData(weatherData: WeatherData): Promise<SheathBlightWarning> {
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
      this.logger.log(`✅ Phân tích Khô Vằn hoàn tất: ${analysis.riskLevel}`);
      return warning;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi phân tích Khô Vằn: ${err.message}`, err.stack);
      throw error;
    }
  }

  private calculateDailyRisk(weatherData: WeatherData): SheathBlightDailyRiskData[] {
    const hourly = weatherData.hourly;
    const dailyData: SheathBlightDailyRiskData[] = [];

    for (let day = 0; day < 7; day++) {
      const startIdx = day * 24;
      const endIdx = startIdx + 24;

      const temps = hourly.temperature_2m.slice(startIdx, endIdx);
      const humidities = hourly.relative_humidity_2m.slice(startIdx, endIdx);
      const rains = hourly.precipitation.slice(startIdx, endIdx);

      const tempAvg = this.average(temps);
      const humidityAvg = this.average(humidities);
      const rainTotal = this.sum(rains);

      // --- LOGIC TÍNH ĐIỂM KHÔ VẰN ---
      // 1. Nhiệt độ: 28-32°C (Cao hơn đạo ôn) (30đ)
      let tempScore = 0;
      if (tempAvg >= 28 && tempAvg <= 32) tempScore = 30;
      else if (tempAvg >= 25 && tempAvg < 28) tempScore = 15;

      // 2. Độ ẩm: > 90% (Rất quan trọng) (40đ)
      let humidityScore = 0;
      if (humidityAvg >= 90) humidityScore = 40;
      else if (humidityAvg >= 85) humidityScore = 20;

      // 3. Mưa: Mưa nhiều làm tăng độ ẩm gốc lúa (30đ)
      let rainScore = 0;
      if (rainTotal >= 10) rainScore = 30;
      else if (rainTotal >= 5) rainScore = 15;

      const riskScore = tempScore + humidityScore + rainScore;

      let riskLevel = 'THẤP';
      if (riskScore >= 70) riskLevel = 'CAO';
      else if (riskScore >= 40) riskLevel = 'TRUNG BÌNH';

      const dateStr = hourly.time[startIdx]?.split('T')[0] || '';
      const date = new Date(dateStr);
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const dayOfWeek = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()] || 'CN';

      dailyData.push({
        date: formattedDate,
        dayOfWeek,
        tempAvg,
        humidityAvg,
        rainTotal,
        riskScore,
        riskLevel,
        breakdown: { tempScore, humidityScore, rainScore },
      });
    }
    return dailyData;
  }

  private analyzeRiskLevel(dailyData: SheathBlightDailyRiskData[]): { riskLevel: string; peakDays: string; highRiskDays: string[] } {
    const maxScore = Math.max(...dailyData.map(d => d.riskScore));
    let riskLevel = 'THẤP';
    if (maxScore >= 70) riskLevel = 'CAO';
    else if (maxScore >= 40) riskLevel = 'TRUNG BÌNH';

    const highRiskDays = dailyData.filter(d => d.riskScore >= 40).map(d => d.date);
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
      msg += `🍄 BỆNH KHÔ VẰN: NGUY CƠ CAO\n`;
      msg += `⚠️ Các ngày nguy cơ cao: ${highRiskDays.join(', ')}\n`;
      msg += `⚠️ Nóng ẩm + Mưa nhiều: Nấm Rhizoctonia solani phát triển cực mạnh.\n`;
      msg += `👉 Đặc biệt nguy hiểm cho ruộng sạ dày, bón thừa đạm.\n`;
      msg += `💊 KHUYẾN CÁO: Phun thuốc (Validacin, Anvil...) khi vết bệnh leo lên 20% chiều cao cây.\n`;
      msg += `💧 Rút bớt nước ruộng nếu có thể để giảm độ ẩm gốc.`;
    } else if (riskLevel === 'TRUNG BÌNH') {
      msg += `🍄 Khô Vằn: Nguy cơ Trung bình\n`;
      if (highRiskDays.length > 0) msg += `⚠️ Các ngày cần chú ý: ${highRiskDays.join(', ')}\n`;
      msg += `⚠️ Thời tiết nóng ẩm, cần chú ý.\n`;
      msg += `👉 Kiểm tra các bụi lúa rậm rạp, chỗ trũng nước.`;
    } else {
      msg += `✅ Khô Vằn: An toàn\n`;
      msg += `Độ ẩm chưa đủ cao để bệnh phát triển mạnh.`;
    }
    return msg;
  }

  private average(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private sum(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0);
  }
}
