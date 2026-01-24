import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiceBlastWarning, DailyRiskData } from '../../entities/rice-blast-warning.entity';
import { LocationService } from '../location/location.service';
import { WeatherService } from '../location/weather.service';
import { AiReasoningService, WeatherData } from '../ai-reasoning/ai-reasoning.service';

/**
 * Interface cho dữ liệu thời tiết từ Open-Meteo API
 */
// WeatherData interface is now imported from ai-reasoning.service.ts

/**
 * Service xử lý logic cảnh báo bệnh đạo ôn lúa
 */
@Injectable()
export class AiRiceBlastService {
  private readonly logger = new Logger(AiRiceBlastService.name);

  constructor(
    @InjectRepository(RiceBlastWarning)
    private warningRepository: Repository<RiceBlastWarning>,
    private locationService: LocationService,
    private weatherService: WeatherService,
    private aiReasoningService: AiReasoningService,
  ) {}

  /**
   * Lấy cảnh báo mới nhất (id = 1)
   */
  async getWarning(): Promise<RiceBlastWarning> {
    const warning = await this.warningRepository.findOne({ where: { id: 1 } });
    if (!warning) {
      // Tạo cảnh báo mặc định nếu chưa có
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

  /**
   * Chạy phân tích bệnh đạo ôn (được gọi bởi cron hoặc manual)
   */
  async runAnalysis(): Promise<RiceBlastWarning> {
    this.logger.log('🔬 Bắt đầu phân tích bệnh đạo ôn (AI Powered)...');

    try {
      // 1. Lấy vị trí hiện tại từ LocationService
      const location = await this.locationService.getLocation();
      this.logger.log(`📍 Vị trí: ${location.name} (${location.lat}, ${location.lon})`);

      // 2. Sử dụng WeatherService chung để lấy dữ liệu thời tiết 7 ngày
      const weatherData = await this.weatherService.fetchWeatherData(location.lat, location.lon);

      // 3. Chạy phân tích với dữ liệu thời tiết
      return this.runAnalysisWithWeatherData(weatherData);

    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi khi phân tích: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Chạy phân tích với dữ liệu thời tiết đã có sẵn
   * Method này được gọi khi LocationService trigger phân tích cho nhiều module
   */
  async runAnalysisWithWeatherData(weatherData: WeatherData): Promise<RiceBlastWarning> {
    try {
      const location = await this.locationService.getLocation();

      // 1. Gọi AI để phân tích rủi ro
      const aiResult = await this.aiReasoningService.analyzeDiseaseRisk(
        'Bệnh Đạo Ôn (Rice Blast)',
        location.name,
        weatherData,
        'Bệnh Đạo Ôn thường phát triển mạnh trong điều kiện nhiệt độ 20-30°C, độ ẩm trên 80%, và có độ chênh lệch nhiệt độ giữa ngày và đêm cao. Các yếu tố như trời âm u, mưa phùn, và sương mù kéo dài nhiều ngày là điều kiện lý tưởng để bệnh phát triển và lây lan trên diện rộng.'
      );

      // 2. Tính toán số liệu thống kê cơ bản từ dữ liệu thời tiết (để hiển thị biểu đồ)
      const basicStats = this.calculateBasicStats(weatherData);

      // Validate AI result
      if (!aiResult.daily_risks || !Array.isArray(aiResult.daily_risks)) {
        this.logger.warn('⚠️ AI không trả về daily_risks, sử dụng fallback data');
        aiResult.daily_risks = [];
      }

      // 3. Merge kết quả AI vào dữ liệu ngày
      const dailyData: DailyRiskData[] = basicStats.map(stat => {
        const aiDay = aiResult.daily_risks.find(d => d.date === stat.dateIso);
        return {
          date: stat.date,
          dayOfWeek: stat.dayOfWeek,
          tempMin: stat.tempMin,
          tempMax: stat.tempMax,
          tempAvg: stat.tempAvg,
          humidityAvg: stat.humidityAvg,
          lwdHours: stat.lwdHours, // Vẫn giữ logic tính LWD cơ bản để tham khảo
          rainTotal: stat.rainTotal,
          rainHours: stat.rainHours,
          fogHours: stat.fogHours,
          cloudCoverAvg: stat.cloudCoverAvg,
          visibilityAvg: stat.visibilityAvg,
          riskScore: aiDay ? aiDay.risk_score : 0, // Dùng điểm số từ AI
          riskLevel: aiDay ? aiDay.risk_level : 'THẤP', // Dùng mức độ từ AI
          breakdown: {
            tempScore: 0, // Không cần breakdown chi tiết nữa vì AI đã tổng hợp
            lwdScore: 0,
            humidityScore: 0,
            rainScore: 0,
            fogScore: 0,
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

      // 6. Lưu vào database
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
        warning = await this.warningRepository.save({
          id: 1,
          ...warningData,
        });
      }

      if (!warning) {
        throw new Error('Failed to save warning');
      }

      this.logger.log(`✅ Phân tích AI hoàn tất: ${aiResult.risk_level}`);
      return warning;

    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi khi phân tích: ${err.message}`, err.stack);
      throw error;
    }
  }

  // Method fetchWeatherData() đã được xóa - sử dụng WeatherService chung thay thế

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
      const clouds = hourly.cloud_cover.slice(startIdx, endIdx);
      const visibilities = hourly.visibility.slice(startIdx, endIdx);
      const weatherCodes = hourly.weather_code.slice(startIdx, endIdx);

      // Tính toán cơ bản
      const tempAvg = this.average(temps);
      const humidityAvg = this.average(humidities);
      
      // Logic mưa thông minh hơn: Chỉ tính khi xác suất >= 50%
      let rainTotal = 0;
      let rainHours = 0;
      for (let i = 0; i < 24; i++) {
        if ((rainProbs[i] ?? 0) >= 50 && (rains[i] ?? 0) > 0.1) {
          rainTotal += rains[i] ?? 0;
          rainHours++;
        }
      }

      // LWD cơ bản (tham khảo)
      let lwdHours = 0;
      for (let i = 0; i < 24; i++) {
        const isWetByDew = (humidities[i] ?? 0) >= 90 && (temps[i] ?? 0) <= (dewPoints[i] ?? 0) + 1.0;
        const isWetByRain = (rainProbs[i] ?? 0) >= 50 && (rains[i] ?? 0) > 0.1;
        if (isWetByDew || isWetByRain) lwdHours++;
      }

      // Fog hours - Cải thiện logic tính sương mù
      // Phương pháp 1: Dựa vào weather_code từ API
      let fogHours = weatherCodes.filter(code => code === 45 || code === 48).length;
      
      // Phương pháp 2: Tính toán dựa trên điều kiện thời tiết thực tế
      // Sương mù xảy ra khi: độ ẩm rất cao + nhiệt độ gần điểm sương + tầm nhìn thấp
      let fogHoursCalculated = 0;
      for (let i = 0; i < 24; i++) {
        const humidity = humidities[i] ?? 0;
        const temp = temps[i] ?? 0;
        const dewPoint = dewPoints[i] ?? 0;
        const visibility = visibilities[i] ?? 10000; // mặc định 10km nếu không có dữ liệu
        
        // Điều kiện sương mù:
        // 1. Độ ẩm >= 95%
        // 2. Nhiệt độ gần điểm sương (chênh lệch <= 0.5°C)
        // 3. Tầm nhìn < 1000m (1km)
        const isHighHumidity = humidity >= 95;
        const isNearDewPoint = temp <= dewPoint + 0.5;
        const isLowVisibility = visibility < 1000;
        
        // Nếu có ít nhất 2/3 điều kiện thì coi như có sương mù
        const fogConditions = [isHighHumidity, isNearDewPoint, isLowVisibility].filter(Boolean).length;
        if (fogConditions >= 2) {
          fogHoursCalculated++;
        }
      }
      
      // Lấy giá trị lớn hơn giữa 2 phương pháp
      fogHours = Math.max(fogHours, fogHoursCalculated);

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
        tempAvg,
        humidityAvg,
        rainTotal: Math.round(rainTotal * 10) / 10,
        rainHours,
        lwdHours,
        fogHours,
        cloudCoverAvg: this.average(clouds),
        visibilityAvg: this.average(visibilities)
      });
    }
    return stats;
  }

  /**
   * Hàm tính trung bình
   */
  private average(arr: number[]): number {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  private getRiskEmoji(level: string): string {
    switch (level) {
      case 'CỰC KỲ NGUY HIỂM':
      case 'RẤT CAO': return '🔴';
      case 'CAO': return '🟠';
      case 'TRUNG BÌNH': return '🟡';
      default: return '🟢';
    }
  }

  /**
   * Format peak_days từ định dạng ISO (YYYY-MM-DD) sang định dạng Việt Nam (DD-MM-YYYY)
   * VD: "2026-01-24, 2026-01-25" -> "24-01-2026, 25-01-2026"
   */
  private formatPeakDays(peakDays: string): string {
    if (!peakDays || peakDays === 'Đang cập nhật') return peakDays;
    
    // Tìm tất cả các ngày theo định dạng YYYY-MM-DD
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
