import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrainDiscolorationWarning, GrainDiscolorationDailyRiskData } from '../../entities/grain-discoloration-warning.entity';
import { LocationService } from '../location/location.service';
import { WeatherService, WeatherData } from '../location/weather.service';

@Injectable()
export class AiGrainDiscolorationService {
  private readonly logger = new Logger(AiGrainDiscolorationService.name);

  constructor(
    @InjectRepository(GrainDiscolorationWarning)
    private warningRepository: Repository<GrainDiscolorationWarning>,
    private locationService: LocationService,
    private weatherService: WeatherService,
  ) {}

  async getWarning(): Promise<GrainDiscolorationWarning> {
    const warning = await this.warningRepository.findOne({ where: { id: 1 } });
    if (!warning) {
      return this.warningRepository.save({
        id: 1,
        generated_at: new Date(),
        risk_level: 'ĐANG CHỜ CẬP NHẬT',
        message: 'Hệ thống đang khởi động...',
        daily_data: [],
      });
    }
    return warning;
  }

  async runAnalysis(): Promise<GrainDiscolorationWarning> {
    this.logger.log('🌾 Bắt đầu phân tích Lem Lép Hạt...');
    try {
      const location = await this.locationService.getLocation();
      const weatherData = await this.weatherService.fetchWeatherData(location.lat, location.lon);
      return this.runAnalysisWithWeatherData(weatherData);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi phân tích Lem Lép Hạt: ${err.message}`, err.stack);
      throw error;
    }
  }

  async runAnalysisWithWeatherData(weatherData: WeatherData): Promise<GrainDiscolorationWarning> {
    try {
      const location = await this.locationService.getLocation();
      const dailyData = this.calculateDailyRisk(weatherData);
      const analysis = this.analyzeRiskLevel(dailyData);
      const message = this.generateWarningMessage(analysis, location.name);

      const warningData = {
        generated_at: new Date(),
        risk_level: analysis.riskLevel,
        message: message,
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
      this.logger.log(`✅ Phân tích Lem Lép Hạt hoàn tất: ${analysis.riskLevel}`);
      return warning;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi phân tích Lem Lép Hạt: ${err.message}`, err.stack);
      throw error;
    }
  }

  private calculateDailyRisk(weatherData: WeatherData): GrainDiscolorationDailyRiskData[] {
    const hourly = weatherData.hourly;
    const dailyData: GrainDiscolorationDailyRiskData[] = [];

    for (let day = 0; day < 7; day++) {
      const startIdx = day * 24;
      const endIdx = startIdx + 24;

      const humidities = hourly.relative_humidity_2m.slice(startIdx, endIdx);
      const rains = hourly.precipitation.slice(startIdx, endIdx);
      const winds = hourly.wind_speed_10m.slice(startIdx, endIdx);

      const humidityAvg = this.average(humidities);
      const rainTotal = this.sum(rains);
      const windSpeedAvg = this.average(winds);

      // --- LOGIC TÍNH ĐIỂM LEM LÉP HẠT ---
      // 1. Mưa: Mưa trong giai đoạn trổ là nguy hiểm nhất (50đ)
      let rainScore = 0;
      if (rainTotal >= 10) rainScore = 50;
      else if (rainTotal >= 5) rainScore = 30;
      else if (rainTotal > 0) rainScore = 10;

      // 2. Độ ẩm: > 90% (30đ)
      let humidityScore = 0;
      if (humidityAvg >= 90) humidityScore = 30;
      else if (humidityAvg >= 85) humidityScore = 15;

      // 3. Gió: Gió mạnh làm va đập hạt (20đ)
      let windScore = 0;
      if (windSpeedAvg >= 15) windScore = 20;
      else if (windSpeedAvg >= 10) windScore = 10;

      const riskScore = rainScore + humidityScore + windScore;

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
        humidityAvg,
        rainTotal,
        windSpeedAvg,
        riskScore,
        riskLevel,
        breakdown: { humidityScore, rainScore, windScore },
      });
    }
    return dailyData;
  }

  private analyzeRiskLevel(dailyData: GrainDiscolorationDailyRiskData[]): { riskLevel: string; highRiskDays: string[] } {
    const maxScore = Math.max(...dailyData.map(d => d.riskScore));
    let riskLevel = 'THẤP';
    if (maxScore >= 70) riskLevel = 'CAO';
    else if (maxScore >= 40) riskLevel = 'TRUNG BÌNH';

    const highRiskDays = dailyData.filter(d => d.riskScore >= 40).map(d => d.date);
    return { riskLevel, highRiskDays };
  }

  private generateWarningMessage(
    analysis: { riskLevel: string; highRiskDays: string[] },
    locationName: string,
  ): string {
    const { riskLevel, highRiskDays } = analysis;
    let msg = `📍 ${locationName}\n\n`;

    if (riskLevel === 'CAO') {
      msg += `🌾 LEM LÉP HẠT: NGUY CƠ CAO\n`;
      msg += `⚠️ Các ngày nguy cơ cao: ${highRiskDays.join(', ')}\n`;
      msg += `⚠️ Mưa nhiều + Ẩm cao: Rất nguy hiểm nếu lúa đang trổ bông.\n`;
      msg += `👉 Nấm/Khuẩn tấn công làm đen hạt, lửng hạt.\n`;
      msg += `💊 KHUYẾN CÁO: Phun ngừa 2 lần:\n`;
      msg += `   1. Khi lúa trổ lẹt xẹt (5%)\n`;
      msg += `   2. Khi lúa trổ đều (100%)\n`;
      msg += `💧 Dùng thuốc hỗn hợp (Tilt Super, Amistar Top...) để trị nhiều bệnh cùng lúc.`;
    } else if (riskLevel === 'TRUNG BÌNH') {
      msg += `🌾 Lem Lép Hạt: Nguy cơ Trung bình\n`;
      if (highRiskDays.length > 0) msg += `⚠️ Các ngày cần chú ý: ${highRiskDays.join(', ')}\n`;
      msg += `⚠️ Có mưa rải rác, cần chú ý.\n`;
      msg += `👉 Nếu lúa đang trổ, nên phun ngừa cho chắc ăn.`;
    } else {
      msg += `✅ Lem Lép Hạt: An toàn\n`;
      msg += `Thời tiết khô ráo, tốt cho lúa trổ và vào gạo.`;
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
