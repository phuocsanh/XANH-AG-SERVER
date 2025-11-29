import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BacterialBlightWarning, BacterialBlightDailyRiskData } from '../../entities/bacterial-blight-warning.entity';
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
    precipitation: number[];
    wind_speed_10m: number[];
  };
}

/**
 * Service xử lý logic cảnh báo bệnh cháy bìa lá do vi khuẩn
 */
@Injectable()
export class AiBacterialBlightService {
  private readonly logger = new Logger(AiBacterialBlightService.name);

  constructor(
    @InjectRepository(BacterialBlightWarning)
    private warningRepository: Repository<BacterialBlightWarning>,
    private locationService: LocationService,
  ) {}

  /**
   * Lấy cảnh báo mới nhất (id = 1)
   */
  async getWarning(): Promise<BacterialBlightWarning> {
    const warning = await this.warningRepository.findOne({ where: { id: 1 } });
    if (!warning) {
      // Tạo cảnh báo mặc định nếu chưa có
      return this.warningRepository.save({
        id: 1,
        generated_at: new Date(),
        risk_level: 'ĐANG CHỜ CẬP NHẬT',
        probability: 0,
        message: 'Hệ thống đang khởi động. Vui lòng chờ phân tích tự động hoặc bấm "Chạy ngay".',
        peak_days: null,
        daily_data: [],
      });
    }
    return warning;
  }

  /**
   * Chạy phân tích bệnh cháy bìa lá (được gọi bởi cron hoặc manual)
   */
  async runAnalysis(): Promise<BacterialBlightWarning> {
    this.logger.log('🔬 Bắt đầu phân tích bệnh cháy bìa lá...');

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
  async runAnalysisWithWeatherData(weatherData: any): Promise<BacterialBlightWarning> {
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
        probability: analysis.probability,
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

      this.logger.log(`✅ Phân tích hoàn tất: ${analysis.riskLevel} (${analysis.probability}%)`);
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
        'precipitation',
        'wind_speed_10m',
      ].join(','),
      forecast_days: 7,
      timezone: 'Asia/Ho_Chi_Minh',
    };

    this.logger.log(`🌤️  Đang lấy dữ liệu thời tiết từ Open-Meteo...`);
    try {
      const agent = new https.Agent({ family: 4 });
      const response = await axios.get(url, { 
        params, 
        timeout: 10000,
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
  private calculateDailyRisk(weatherData: WeatherData): BacterialBlightDailyRiskData[] {
    const hourly = weatherData.hourly;
    const dailyData: BacterialBlightDailyRiskData[] = [];

    // Chia 168 giờ thành 7 ngày (mỗi ngày 24 giờ)
    for (let day = 0; day < 7; day++) {
      const startIdx = day * 24;
      const endIdx = startIdx + 24;

      // Lấy dữ liệu 24 giờ của ngày này
      const temps = hourly.temperature_2m.slice(startIdx, endIdx);
      const humidities = hourly.relative_humidity_2m.slice(startIdx, endIdx);
      const rains = hourly.precipitation.slice(startIdx, endIdx);
      const winds = hourly.wind_speed_10m.slice(startIdx, endIdx);

      // Tính các chỉ số
      const tempAvg = this.average(temps);
      const tempMin = Math.min(...temps);
      const tempMax = Math.max(...temps);
      const humidityAvg = this.average(humidities);
      const rainTotal = this.sum(rains);
      const rainHours = rains.filter(r => r > 0).length;
      const windSpeedMax = Math.max(...winds);
      const windSpeedAvg = this.average(winds);

      // Tính tổng mưa 3 ngày (nguy cơ ngập)
      let rain3Days = rainTotal;
      if (day >= 1) {
        const prevDayRains = hourly.precipitation.slice((day - 1) * 24, day * 24);
        rain3Days += this.sum(prevDayRains);
      }
      if (day >= 2) {
        const prevPrevDayRains = hourly.precipitation.slice((day - 2) * 24, (day - 1) * 24);
        rain3Days += this.sum(prevPrevDayRains);
      }

      // Tính điểm nguy cơ từng yếu tố
      const tempScore = this.calculateTempScore(tempAvg);
      const rainScore = this.calculateRainScore(rainTotal, rainHours);
      const windScore = this.calculateWindScore(windSpeedMax, windSpeedAvg);
      const humidityScore = humidityAvg >= 85 ? 20 : (humidityAvg >= 80 ? 10 : 0);
      const floodScore = this.calculateFloodScore(rain3Days);

      // Tổng điểm nguy cơ (tối đa 135)
      const riskScore = tempScore + rainScore + windScore + humidityScore + floodScore;

      // Xác định mức độ nguy cơ
      let riskLevel = 'AN TOÀN';
      if (riskScore >= 100) riskLevel = 'CỰC KỲ NGUY HIỂM';
      else if (riskScore >= 80) riskLevel = 'RẤT CAO';
      else if (riskScore >= 70) riskLevel = 'CAO';
      else if (riskScore >= 50) riskLevel = 'TRUNG BÌNH';
      else if (riskScore >= 30) riskLevel = 'THẤP';

      // Lấy ngày tháng
      const dateStr = hourly.time[startIdx]?.split('T')[0] || '';
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
        rainTotal,
        rainHours,
        windSpeedMax,
        windSpeedAvg,
        rain3Days,
        riskScore,
        riskLevel,
        breakdown: {
          tempScore,
          rainScore,
          windScore,
          humidityScore,
          floodScore,
        },
      });
    }

    return dailyData;
  }

  /**
   * Tính điểm nhiệt độ (0-30 điểm) - Cao hơn đạo ôn
   */
  private calculateTempScore(tempAvg: number): number {
    if (tempAvg >= 25 && tempAvg <= 34) return 30;
    if ((tempAvg >= 22 && tempAvg < 25) || (tempAvg > 34 && tempAvg <= 36)) return 15;
    return 0;
  }

  /**
   * Tính điểm mưa (0-40 điểm) - Quan trọng hơn đạo ôn
   */
  private calculateRainScore(rainTotal: number, rainHours: number): number {
    if (rainTotal >= 50) return 40;
    if (rainTotal >= 30) return 30;
    if (rainTotal >= 15) return 20;
    if (rainHours >= 6) return 10;
    return 0;
  }

  /**
   * Tính điểm gió (0-25 điểm) - Yếu tố mới so với đạo ôn
   */
  private calculateWindScore(windMax: number, windAvg: number): number {
    if (windMax >= 20) return 25;
    if (windMax >= 15 || windAvg >= 12) return 15;
    if (windAvg >= 8) return 10;
    return 0;
  }

  /**
   * Tính điểm ngập úng (0-20 điểm) - Yếu tố mới
   */
  private calculateFloodScore(rain3Days: number): number {
    if (rain3Days >= 100) return 20;
    if (rain3Days >= 70) return 15;
    if (rain3Days >= 50) return 10;
    return 0;
  }

  /**
   * Phân tích mức độ cảnh báo dựa trên dữ liệu 7 ngày
   */
  private analyzeRiskLevel(dailyData: BacterialBlightDailyRiskData[]): {
    riskLevel: string;
    probability: number;
    peakDays: string;
    highRiskDays: BacterialBlightDailyRiskData[];
  } {
    const maxScore = Math.max(...dailyData.map(d => d.riskScore));
    const highRiskDays = dailyData.filter(d => d.riskScore >= 70).sort((a, b) => b.riskScore - a.riskScore);

    const probability = Math.min(100, Math.round(maxScore * 0.9 + 15));

    let riskLevel = 'AN TOÀN';
    let peakDays = '';

    if (dailyData.some(d => d.riskScore >= 100)) {
      riskLevel = 'RẤT CAO';
      const redDays = dailyData.filter(d => d.riskScore >= 100);
      peakDays = this.formatPeakDays(redDays);
    } else if (this.hasConsecutiveDays(dailyData, 80, 2)) {
      riskLevel = 'CAO';
      const orangeDays = dailyData.filter(d => d.riskScore >= 80);
      peakDays = this.formatPeakDays(orangeDays);
    } else if (this.hasConsecutiveDays(dailyData, 70, 3)) {
      riskLevel = 'TRUNG BÌNH';
      const yellowDays = dailyData.filter(d => d.riskScore >= 70);
      peakDays = this.formatPeakDays(yellowDays);
    } else if (maxScore >= 50) {
      riskLevel = 'THẤP';
    }

    return { riskLevel, probability, peakDays, highRiskDays };
  }

  /**
   * Kiểm tra có N ngày liên tiếp >= threshold không
   */
  private hasConsecutiveDays(dailyData: BacterialBlightDailyRiskData[], threshold: number, count: number): boolean {
    let consecutive = 0;
    for (const day of dailyData) {
      if (day.riskScore >= threshold) {
        consecutive++;
        if (consecutive >= count) return true;
      } else {
        consecutive = 0;
      }
    }
    return false;
  }

  /**
   * Format ngày cao điểm
   */
  private formatPeakDays(days: BacterialBlightDailyRiskData[]): string {
    if (days.length === 0) return '';
    if (days.length === 1) return days[0]?.date || '';
    return `${days[0]?.date || ''} – ${days[days.length - 1]?.date || ''}`;
  }

  /**
   * Tạo tin nhắn cảnh báo tiếng Việt
   */
  private generateWarningMessage(
    analysis: { riskLevel: string; probability: number; peakDays: string; highRiskDays: BacterialBlightDailyRiskData[] },
    locationName: string,
  ): string {
    const { riskLevel, peakDays, highRiskDays } = analysis;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = `${today.getDate()}/${today.getMonth() + 1}`;
    const tomorrowStr = `${tomorrow.getDate()}/${tomorrow.getMonth() + 1}`;

    if (riskLevel === 'RẤT CAO') {
      const maxRain = Math.max(...highRiskDays.map(d => d.rainTotal));
      const maxWind = Math.max(...highRiskDays.map(d => d.windSpeedMax));
      return `🔴 CẢNH BÁO ĐỎ BỆNH CHÁY BÌA LÁ

📍 ${locationName}
⚠️ Nguy cơ bùng phát TRONG 2–4 NGÀY TỚI (${peakDays})
🌧️ Mưa lớn ${maxRain.toFixed(1)}mm + gió mạnh ${maxWind.toFixed(1)} km/h → VI KHUẨN LÂY LAN NHANH!

💊 KHUYẾN CÁO: Phun NGAY hôm nay hoặc ngày mai (${todayStr}–${tomorrowStr}) trước khi mưa

🧪 Hoạt chất khuyên dùng:
• Streptomycin sulfate
• Copper hydroxide (Đồng)
• Validamycin + Kasugamycin
• Bismerthiazol

⏰ THỜI ĐIỂM PHUN TỐT NHẤT:
• Chiều mát: 16:00 – 18:00 (Hiệu quả nhất)
• Sáng sớm: 7:00 – 9:00 (Khi lá đã khô sương)
🚫 TUYỆT ĐỐI KHÔNG phun khi lá còn ướt hoặc trời sắp mưa
💧 Dùng đủ nước (400–500 lít/ha) để thuốc phủ đều`;
    }

    if (riskLevel === 'CAO') {
      const avgRain = Math.round(this.average(highRiskDays.map(d => d.rainTotal)));
      return `🟠 CẢNH BÁO SỚM – Nguy cơ đang tăng cao

📍 ${locationName}
⚠️ Dự báo 3–5 ngày tới có điều kiện thuận lợi (${peakDays})
🌧️ Mưa ${avgRain}mm + độ ẩm cao → nguy cơ lây nhiễm

💊 KHUYẾN CÁO: Chuẩn bị thuốc và theo dõi thêm 1–2 ngày
Nếu thấy vết bệnh → phun NGAY

🧪 Hoạt chất khuyên dùng:
• Streptomycin sulfate
• Copper hydroxide
• Validamycin + Kasugamycin`;
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
✅ Chưa có dấu hiệu nguy cơ bệnh cháy bìa lá
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
