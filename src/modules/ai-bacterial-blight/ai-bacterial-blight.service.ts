import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BacterialBlightWarning, BacterialBlightDailyRiskData } from '../../entities/bacterial-blight-warning.entity';
import { LocationService } from '../location/location.service';
import { WeatherService } from '../location/weather.service';
import { AiReasoningService, WeatherData } from '../ai-reasoning/ai-reasoning.service';

@Injectable()
export class AiBacterialBlightService {
  private readonly logger = new Logger(AiBacterialBlightService.name);

  constructor(
    @InjectRepository(BacterialBlightWarning)
    private warningRepository: Repository<BacterialBlightWarning>,
    private locationService: LocationService,
    private weatherService: WeatherService,
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
      const weatherData = await this.weatherService.fetchWeatherData(location.lat, location.lon);
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
        'Bệnh phát triển mạnh khi mưa nhiều, gió mạnh làm lá bị rách, nhiệt độ 25-30°C, độ ẩm cao >80%. Ngập úng kéo dài làm bệnh bùng phát nhanh.'
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

      // 4. Format peak_days từ AI (chuyển từ ISO sang định dạng Việt Nam)
      const formattedPeakDays = this.formatPeakDays(aiResult.peak_days);

      // 5. Tạo nội dung cảnh báo từ AI
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

      // 5. Lưu vào database
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

      this.logger.log(`✅ Phân tích AI hoàn tất: ${aiResult.risk_level}`);
      return warning!;

    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi khi phân tích: ${err.message}`, err.stack);
      throw error;
    }
  }

  // Method fetchWeatherData() đã được xóa - sử dụng WeatherService chung

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
      const dewPoints = hourly.dew_point_2m.slice(startIdx, endIdx);
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

      // LWD (Leaf Wetness Duration) - Thời gian lá ướt
      let lwdHours = 0;
      for (let i = 0; i < 24; i++) {
        const isWetByDew = (humidities[i] ?? 0) >= 90 && (temps[i] ?? 0) <= (dewPoints[i] ?? 0) + 1.0;
        const isWetByRain = (rainProbs[i] ?? 0) >= 50 && (rains[i] ?? 0) > 0.1;
        if (isWetByDew || isWetByRain) lwdHours++;
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
        lwdHours, // Thêm LWD
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

  /**
   * Format peak_days từ định dạng ISO (YYYY-MM-DD) sang định dạng Việt Nam (DD-MM-YYYY)
   */
  private formatPeakDays(peakDays: string): string {
    if (!peakDays || peakDays === 'Đang cập nhật') return peakDays;
    const isoDateRegex = /\d{4}-\d{2}-\d{2}/g;
    const matches = peakDays.match(isoDateRegex);
    if (!matches) return peakDays;
    let formatted = peakDays;
    matches.forEach(isoDate => {
      const [year, month, day] = isoDate.split('-');
      const vnDate = `${day}-${month}-${year}`;
      formatted = formatted.replace(isoDate, vnDate);
    });
    return formatted;
  }
}
