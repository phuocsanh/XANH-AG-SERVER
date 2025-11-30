import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrownPlantHopperWarning, BPHDailyRiskData } from '../../entities/brown-plant-hopper-warning.entity';
import { LocationService } from '../location/location.service';
import { WeatherService, WeatherData } from '../location/weather.service';

@Injectable()
export class AiBrownPlantHopperService {
  private readonly logger = new Logger(AiBrownPlantHopperService.name);

  constructor(
    @InjectRepository(BrownPlantHopperWarning)
    private warningRepository: Repository<BrownPlantHopperWarning>,
    private locationService: LocationService,
    private weatherService: WeatherService,
  ) {}

  async getWarning(): Promise<BrownPlantHopperWarning> {
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

  async runAnalysis(): Promise<BrownPlantHopperWarning> {
    this.logger.log('🦗 Bắt đầu phân tích Rầy Nâu...');
    try {
      const location = await this.locationService.getLocation();
      const weatherData = await this.weatherService.fetchWeatherData(location.lat, location.lon);
      return this.runAnalysisWithWeatherData(weatherData);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi phân tích Rầy Nâu: ${err.message}`, err.stack);
      throw error;
    }
  }

  async runAnalysisWithWeatherData(weatherData: WeatherData): Promise<BrownPlantHopperWarning> {
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
      this.logger.log(`✅ Phân tích Rầy Nâu hoàn tất: ${analysis.riskLevel}`);
      return warning;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi phân tích Rầy Nâu: ${err.message}`, err.stack);
      throw error;
    }
  }

  private calculateDailyRisk(weatherData: WeatherData): BPHDailyRiskData[] {
    const hourly = weatherData.hourly;
    const dailyData: BPHDailyRiskData[] = [];

    for (let day = 0; day < 7; day++) {
      const startIdx = day * 24;
      const endIdx = startIdx + 24;

      const temps = hourly.temperature_2m.slice(startIdx, endIdx);
      const humidities = hourly.relative_humidity_2m.slice(startIdx, endIdx);
      const rains = hourly.precipitation.slice(startIdx, endIdx);
      const winds = hourly.wind_speed_10m.slice(startIdx, endIdx);

      const tempAvg = this.average(temps);
      const humidityAvg = this.average(humidities);
      const rainTotal = this.sum(rains);
      const windSpeedAvg = this.average(winds);

      // --- LOGIC TÍNH ĐIỂM RẦY NÂU ---
      // 1. Nhiệt độ: 25-30°C là lý tưởng nhất (40đ)
      let tempScore = 0;
      if (tempAvg >= 25 && tempAvg <= 30) tempScore = 40;
      else if (tempAvg >= 22 && tempAvg < 25) tempScore = 20;
      else if (tempAvg > 30 && tempAvg <= 32) tempScore = 20;

      // 2. Độ ẩm: > 80% (30đ)
      let humidityScore = 0;
      if (humidityAvg >= 85) humidityScore = 30;
      else if (humidityAvg >= 80) humidityScore = 20;

      // 3. Mưa: Mưa nắng xen kẽ (mưa nhỏ < 10mm) (15đ)
      let rainScore = 0;
      if (rainTotal > 0 && rainTotal < 10) rainScore = 15;
      else if (rainTotal >= 10) rainScore = 5; // Mưa to quá rầy bị rửa trôi bớt

      // 4. Gió: Gió mạnh giúp di trú (15đ)
      let windScore = 0;
      if (windSpeedAvg >= 10) windScore = 15; // Gió > 10km/h
      else if (windSpeedAvg >= 5) windScore = 5;

      const riskScore = tempScore + humidityScore + rainScore + windScore;

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
        rainTotal,
        windSpeedAvg,
        riskScore,
        riskLevel,
        breakdown: { tempScore, humidityScore, rainScore, windScore },
      });
    }
    return dailyData;
  }

  private analyzeRiskLevel(dailyData: BPHDailyRiskData[]): { riskLevel: string; peakDays: string; highRiskDays: string[] } {
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
      msg += `🦗 RẦY NÂU: NGUY CƠ CAO\n`;
      msg += `⚠️ Các ngày nguy cơ cao: ${highRiskDays.join(', ')}\n`;
      msg += `⚠️ Thời tiết 25-30°C + Ẩm cao: Rất thuận lợi cho trứng rầy nở.\n`;
      msg += `🌬️ Có gió mạnh: Cảnh giác rầy di trú từ nơi khác đến.\n`;
      msg += `👉 KHUYẾN CÁO: Ra thăm đồng NGAY. Vạch gốc lúa kiểm tra.\n`;
      msg += `💊 Nếu mật độ > 3 con/tép: Phun thuốc đặc trị rầy (Chess, Applaud...).\n`;
      msg += `🚫 Tuyệt đối không phun ngừa khi chưa thấy rầy (tránh bùng phát rầy kháng thuốc).`;
    } else if (riskLevel === 'TRUNG BÌNH') {
      msg += `🦗 Rầy Nâu: Nguy cơ Trung bình\n`;
      if (highRiskDays.length > 0) msg += `⚠️ Các ngày cần chú ý: ${highRiskDays.join(', ')}\n`;
      msg += `⚠️ Thời tiết đang ấm dần, rầy có thể phát triển.\n`;
      msg += `👉 Nên thăm đồng thường xuyên 3 ngày/lần.\n`;
      msg += `🔍 Chú ý kỹ giai đoạn lúa đẻ nhánh - làm đòng.`;
    } else {
      msg += `✅ Rầy Nâu: An toàn\n`;
      msg += `Thời tiết hiện tại chưa thuận lợi cho rầy bùng phát.`;
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
