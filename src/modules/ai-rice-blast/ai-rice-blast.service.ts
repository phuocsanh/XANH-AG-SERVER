import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiceBlastWarning, DailyRiskData } from '../../entities/rice-blast-warning.entity';
import { LocationService } from '../location/location.service';
import axios from 'axios';
import * as https from 'https';

/**
 * Interface cho dữ liệu thời tiết từ Open-Meteo API
 */
interface WeatherData {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    dew_point_2m: number[];
    precipitation: number[];
    cloud_cover_low: number[];
    visibility: number[];
    weather_code: number[];
  };
}

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
    this.logger.log('🔬 Bắt đầu phân tích bệnh đạo ôn...');

    try {
      // 1. Lấy vị trí hiện tại từ LocationService
      const location = await this.locationService.getLocation();
      this.logger.log(`📍 Vị trí: ${location.name} (${location.lat}, ${location.lon})`);

      // 2. Gọi API Open-Meteo để lấy dữ liệu thời tiết 7 ngày
      const weatherData = await this.fetchWeatherData(location.lat, location.lon);

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
  async runAnalysisWithWeatherData(weatherData: any): Promise<RiceBlastWarning> {
    try {
      const location = await this.locationService.getLocation();

      // Tính toán nguy cơ bệnh từng ngày
      const dailyData = this.calculateDailyRisk(weatherData);

      // Phân tích mức độ cảnh báo
      const analysis = this.analyzeRiskLevel(dailyData);

      // Tạo tin nhắn cảnh báo
      const message = this.generateWarningMessage(analysis, location.name);

      // Lưu kết quả vào database (UPSERT id = 1)
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
        warning = await this.warningRepository.save({
          id: 1,
          ...warningData,
        });
      }

      if (!warning) {
        throw new Error('Failed to save warning');
      }

      this.logger.log(`✅ Phân tích hoàn tất: ${analysis.riskLevel}`);
      return warning;

    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi khi phân tích: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Gọi API Open-Meteo để lấy dữ liệu thời tiết hourly 7 ngày
   */
  private async fetchWeatherData(lat: number, lon: number): Promise<WeatherData> {
    const url = 'https://api.open-meteo.com/v1/forecast';
    const params = {
      latitude: lat,
      longitude: lon,
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'dew_point_2m',
        'precipitation',
        'cloud_cover_low',
        'visibility',
        'weather_code',
      ].join(','),
      forecast_days: 7,
      timezone: 'Asia/Ho_Chi_Minh',
    };

    this.logger.log(`🌤️  Đang lấy dữ liệu thời tiết từ Open-Meteo...`);
    try {
      // Force IPv4 to avoid Docker IPv6 resolution issues
      const agent = new https.Agent({ family: 4 });
      const response = await axios.get(url, { 
        params, 
        timeout: 10000, // Tăng timeout lên 10s
        httpsAgent: agent
      });
      return response.data;
    } catch (error) {
      this.logger.error(`❌ Không thể kết nối đến Open-Meteo API: ${error}`);
      throw new Error('Lỗi kết nối mạng hoặc API thời tiết không phản hồi. Vui lòng kiểm tra kết nối internet.');
    }
  }

  /**
   * Tính toán nguy cơ bệnh từng ngày (168 giờ → 7 ngày)
   */
  private calculateDailyRisk(weatherData: WeatherData): DailyRiskData[] {
    const hourly = weatherData.hourly;
    const dailyData: DailyRiskData[] = [];

    // Chia 168 giờ thành 7 ngày (mỗi ngày 24 giờ)
    for (let day = 0; day < 7; day++) {
      const startIdx = day * 24;
      const endIdx = startIdx + 24;

      // Lấy dữ liệu 24 giờ của ngày này
      const temps = hourly.temperature_2m.slice(startIdx, endIdx);
      const humidities = hourly.relative_humidity_2m.slice(startIdx, endIdx);
      const dewPoints = hourly.dew_point_2m.slice(startIdx, endIdx);
      const rains = hourly.precipitation.slice(startIdx, endIdx);
      const clouds = hourly.cloud_cover_low.slice(startIdx, endIdx);
      const visibilities = hourly.visibility.slice(startIdx, endIdx);
      const weatherCodes = hourly.weather_code.slice(startIdx, endIdx);

      // Tính các chỉ số trung bình
      const tempAvg = this.average(temps);
      const tempMin = Math.min(...temps);
      const tempMax = Math.max(...temps);
      const humidityAvg = this.average(humidities);
      const rainTotal = this.sum(rains);
      const cloudCoverAvg = this.average(clouds);
      const visibilityAvg = this.average(visibilities);

      // Tính số giờ lá ướt (LWD) - YẾU TỐ QUAN TRỌNG NHẤT
      // Bao gồm cả thời gian có mưa
      const lwdHours = this.calculateLWD(temps, humidities, dewPoints, rains);

      // Tính số giờ có mưa
      const rainHours = rains.filter(r => r > 0).length;

      // Tính số giờ có sương mù (weather_code = 45 hoặc 48)
      const fogHours = weatherCodes.filter(code => code === 45 || code === 48).length;

      // Tính điểm nguy cơ từng yếu tố
      const tempScore = this.calculateTempScore(tempAvg);
      const lwdScore = this.calculateLWDScore(lwdHours);
      const humidityScore = humidityAvg >= 92 ? 15 : 0;
      const rainScore = this.calculateRainScore(rainTotal, rainHours);
      const fogScore = this.calculateFogScore(cloudCoverAvg, visibilityAvg, fogHours);

      // Tổng điểm nguy cơ (tối đa 135)
      const riskScore = tempScore + lwdScore + humidityScore + rainScore + fogScore;

      // Xác định mức độ nguy cơ
      let riskLevel = 'AN TOÀN';
      if (riskScore >= 100) riskLevel = 'CỰC KỲ NGUY HIỂM';
      else if (riskScore >= 80) riskLevel = 'RẤT CAO';
      else if (riskScore >= 70) riskLevel = 'CAO';
      else if (riskScore >= 50) riskLevel = 'TRUNG BÌNH';
      else if (riskScore >= 30) riskLevel = 'THẤP';

      // Lấy ngày tháng
      const dateStr = hourly.time[startIdx]?.split('T')[0] || ''; // YYYY-MM-DD
      const date = new Date(dateStr);
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const dayOfWeek = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()] || 'CN';


      dailyData.push({

        date: formattedDate,
        dayOfWeek,
        tempMin,
        tempMax,
        tempAvg,
        humidityAvg,
        lwdHours,
        rainTotal,
        rainHours,
        fogHours,
        cloudCoverAvg,
        visibilityAvg,
        riskScore,
        riskLevel,
        breakdown: {
          tempScore,
          lwdScore,
          humidityScore,
          rainScore,
          fogScore,
        },
      });
    }

    return dailyData;
  }

  /**
   * Tính số giờ lá ướt (Leaf Wetness Duration)
   * Điều kiện: (RH >= 90% VÀ Temp <= DewPoint + 1.0°C) HOẶC (Có mưa > 0mm)
   */
  private calculateLWD(temps: number[], humidities: number[], dewPoints: number[], rains: number[]): number {
    let lwdHours = 0;
    for (let i = 0; i < temps.length; i++) {
      const isWetByDew = (humidities[i] ?? 0) >= 90 && (temps[i] ?? 0) <= (dewPoints[i] ?? 0) + 1.0;
      const isWetByRain = (rains[i] ?? 0) > 0;
      
      if (isWetByDew || isWetByRain) {
        lwdHours++;
      }
    }
    return lwdHours;
  }

  /**
   * Tính điểm nhiệt độ (0-30 điểm)
   */
  private calculateTempScore(tempAvg: number): number {
    if (tempAvg >= 20 && tempAvg <= 30) return 30;
    if ((tempAvg >= 18 && tempAvg < 20) || (tempAvg > 30 && tempAvg <= 32)) return 15;
    return 0;
  }

  /**
   * Tính điểm lá ướt (0-50 điểm)
   */
  private calculateLWDScore(lwdHours: number): number {
    if (lwdHours >= 14) return 50;
    if (lwdHours >= 10) return 40;
    if (lwdHours >= 7) return 20;
    return 0;
  }

  /**
   * Tính điểm mưa (0-15 điểm)
   */
  private calculateRainScore(rainTotal: number, rainHours: number): number {
    if (rainTotal >= 5) return 15;
    if (rainHours >= 6) return 10;
    return 0;
  }

  /**
   * Tính điểm sương mù / trời âm u (0-25 điểm)
   */
  private calculateFogScore(cloudCoverAvg: number, visibilityAvg: number, fogHours: number): number {
    if (cloudCoverAvg >= 70) return 25;
    if (visibilityAvg < 2000) return 25;
    if (fogHours >= 4) return 25;
    return 0;
  }

  /**
   * Kiểm tra có chuỗi ngày thuận lợi SẢN XUẤT bào tử không
   * Điều kiện: RH ≥ 93%, Temp 20-27°C, ít nhất 3 ngày liên tiếp
   */
  private hasSporulationPattern(dailyData: DailyRiskData[]): boolean {
    let consecutiveDays = 0;
    
    for (const day of dailyData) {
      // Điều kiện sản xuất bào tử theo nghiên cứu khoa học
      if (day.humidityAvg >= 93 && day.tempAvg >= 20 && day.tempAvg <= 27) {
        consecutiveDays++;
        if (consecutiveDays >= 3) return true; // 3+ ngày liên tiếp
      } else {
        consecutiveDays = 0; // Reset nếu gián đoạn
      }
    }
    
    return false;
  }

  /**
   * Kiểm tra có chuỗi ngày thuận lợi NHIỄM BỆNH không
   * Điều kiện: LWD ≥ 10h, RH ≥ 90%, ít nhất 2 ngày liên tiếp
   */
  private hasInfectionPattern(dailyData: DailyRiskData[]): boolean {
    let consecutiveDays = 0;
    
    for (const day of dailyData) {
      // Điều kiện nhiễm bệnh: lá ướt lâu + độ ẩm cao
      if (day.lwdHours >= 10 && day.humidityAvg >= 90) {
        consecutiveDays++;
        if (consecutiveDays >= 2) return true; // 2+ ngày liên tiếp
      } else {
        consecutiveDays = 0;
      }
    }
    
    return false;
  }

  /**
   * Đếm số ngày có mưa trong 7 ngày
   */
  private countRainyDays(dailyData: DailyRiskData[]): number {
    return dailyData.filter(d => d.rainTotal > 0).length;
  }

  /**
   * Tính điểm nguy cơ tích lũy (Cumulative Risk Score - theo EPIRICE)
   */
  private calculateCumulativeRisk(dailyData: DailyRiskData[]): {
    totalScore: number;
    avgScore: number;
    daysAbove70: number;
    daysAbove50: number;
  } {
    const totalScore = dailyData.reduce((sum, day) => sum + day.riskScore, 0);
    const avgScore = totalScore / dailyData.length;
    const daysAbove70 = dailyData.filter(d => d.riskScore >= 70).length;
    const daysAbove50 = dailyData.filter(d => d.riskScore >= 50).length;
    
    return { totalScore, avgScore, daysAbove70, daysAbove50 };
  }

  /**
   * Phân tích mức độ cảnh báo dựa trên dữ liệu 7 ngày
   * Áp dụng logic Weather Pattern theo chuẩn EPIRICE và nghiên cứu khoa học
   */
  private analyzeRiskLevel(dailyData: DailyRiskData[]): {
    riskLevel: string;
    peakDays: string;
    highRiskDays: DailyRiskData[];
  } {
    // Tìm ngày có điểm cao nhất
    const maxScore = Math.max(...dailyData.map(d => d.riskScore));
    const highRiskDays = dailyData.filter(d => d.riskScore >= 70).sort((a, b) => b.riskScore - a.riskScore);

    // ✨ KIỂM TRA WEATHER PATTERN (Chuỗi mẫu thời tiết)
    const hasSporulation = this.hasSporulationPattern(dailyData);  // Điều kiện sản xuất bào tử
    const hasInfection = this.hasInfectionPattern(dailyData);      // Điều kiện nhiễm bệnh
    const rainyDays = this.countRainyDays(dailyData);              // Số ngày mưa
    const cumulative = this.calculateCumulativeRisk(dailyData);    // Điểm tích lũy

    // ✨ XÁC ĐỊNH RISK_LEVEL VỚI LOGIC PATTERN
    let riskLevel = 'AN TOÀN';
    let peakDays = '';

    // Quy tắc A: maxScore >= 100 VÀ có pattern mạnh
    if (maxScore >= 100 && (hasSporulation || hasInfection)) {
      riskLevel = 'RẤT CAO';
      const redDays = dailyData.filter(d => d.riskScore >= 100);
      peakDays = this.formatPeakDays(redDays);
    }
    // Quy tắc B: maxScore >= 80 VÀ có CẢ 2 pattern (sản xuất bào tử + nhiễm bệnh)
    else if (maxScore >= 80 && hasSporulation && hasInfection) {
      riskLevel = 'CAO';
      const orangeDays = dailyData.filter(d => d.riskScore >= 80);
      peakDays = this.formatPeakDays(orangeDays);
    }
    // Quy tắc B2: maxScore >= 80 VÀ có ít nhất 1 pattern HOẶC nhiều ngày mưa
    else if (maxScore >= 80 && (hasSporulation || hasInfection || rainyDays >= 5)) {
      riskLevel = 'CAO';
      const orangeDays = dailyData.filter(d => d.riskScore >= 80);
      peakDays = this.formatPeakDays(orangeDays);
    }
    // Quy tắc C: maxScore >= 70 VÀ cumulative score cao
    else if (maxScore >= 70 && cumulative.avgScore >= 50) {
      riskLevel = 'TRUNG BÌNH';
      const yellowDays = dailyData.filter(d => d.riskScore >= 70);
      peakDays = this.formatPeakDays(yellowDays);
    }
    // Quy tắc C2: maxScore >= 70 NHƯNG cumulative thấp → Hạ xuống THẤP
    else if (maxScore >= 70) {
      riskLevel = 'THẤP';
      const yellowDays = dailyData.filter(d => d.riskScore >= 70);
      peakDays = this.formatPeakDays(yellowDays);
    }
    // Quy tắc D: maxScore >= 50
    else if (maxScore >= 50) {
      riskLevel = 'THẤP';
    }

    return { riskLevel, peakDays, highRiskDays };
  }

  /**
   * Format ngày cao điểm (VD: "30/11 – 02/12")
   */
  private formatPeakDays(days: DailyRiskData[]): string {
    if (days.length === 0) return '';
    if (days.length === 1) return days[0]?.date || '';
    return `${days[0]?.date || ''} – ${days[days.length - 1]?.date || ''}`;
  }

  /**
   * Tạo tin nhắn cảnh báo tiếng Việt đẹp
   */
  private generateWarningMessage(
    analysis: { riskLevel: string; peakDays: string; highRiskDays: DailyRiskData[] },
    locationName: string,
  ): string {
    const { riskLevel, peakDays, highRiskDays } = analysis;

    // Lấy ngày hôm nay và ngày mai
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = `${today.getDate()}/${today.getMonth() + 1}`;
    const tomorrowStr = `${tomorrow.getDate()}/${tomorrow.getMonth() + 1}`;

    if (riskLevel === 'RẤT CAO') {
      const maxLWD = Math.max(...highRiskDays.map(d => d.lwdHours));
      return `🔴 CẢNH BÁO ĐỎ BỆNH ĐẠO ÔN

📍 ${locationName}
⚠️ Nguy cơ bùng phát TRONG 2–4 NGÀY TỚI (${peakDays})
🌫️ Sương mù dày + lá ướt ${maxLWD} giờ → CỰC KỲ THUẬN LỢI cho nấm!

💊 KHUYẾN CÁO: Phun NGAY hôm nay hoặc ngày mai (${todayStr}–${tomorrowStr}) khi trời còn khô ráo

⏰ THỜI ĐIỂM PHUN TỐT NHẤT:
• Sáng sớm: 8:00 – 10:00 (Sau khi tan sương)
• Chiều mát: 16:00 – 18:00
🚫 TRÁNH phun khi trời đang có sương mù hoặc sắp mưa
💧 Dùng đủ nước (400–500 lít/ha) để thuốc phủ đều`;
    }

    if (riskLevel === 'CAO') {
      const maxLWD = Math.max(...highRiskDays.map(d => d.lwdHours));
      return `🟠 CẢNH BÁO SỚM – Nguy cơ đang tăng cao

📍 ${locationName}
⚠️ Dự báo 3–5 ngày tới có điều kiện thuận lợi (${peakDays})
🌧️ Lá ướt lên tới ${maxLWD} giờ/ngày + độ ẩm cao → nguy cơ lây nhiễm

💊 KHUYẾN CÁO: Chuẩn bị thuốc và theo dõi thêm 1–2 ngày
Nếu thấy vết bệnh → phun NGAY
`;
    }

    if (riskLevel === 'TRUNG BÌNH') {
      return `🟡 CẢNH BÁO VÀNG – Nguy cơ trung bình

📍 ${locationName}
⚠️ Có dấu hiệu thuận lợi cho bệnh (${peakDays})
🌦️ Nên theo dõi sát ruộng 2–3 ngày tới

💊 KHUYẾN CÁO: Chuẩn bị thuốc phòng ngừa
Kiểm tra lá lúa mỗi ngày, nếu thấy vết bệnh → phun ngay`;
    }

    if (riskLevel === 'THẤP') {
      return `🟢 Nguy cơ THẤP – Chưa cần phun

📍 ${locationName}
✅ Điều kiện thời tiết chưa thuận lợi cho bệnh
🔍 Tiếp tục theo dõi và sẽ báo khi có nguy cơ`;
    }

    return `✅ HIỆN TẠI AN TOÀN

📍 ${locationName}
✅ Chưa có dấu hiệu nguy cơ bệnh đạo ôn
🔍 Hệ thống sẽ tiếp tục theo dõi và cảnh báo khi cần`;
  }

  /**
   * Hàm tính trung bình
   */
  private average(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /**
   * Hàm tính tổng
   */
  private sum(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0);
  }
}
