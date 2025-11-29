import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../../entities/location.entity';
import { RiceBlastWarning, DailyRiskData } from '../../entities/rice-blast-warning.entity';
import { UpdateLocationDto } from './dto/update-location.dto';
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
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(RiceBlastWarning)
    private warningRepository: Repository<RiceBlastWarning>,
  ) {}

  /**
   * Lấy vị trí hiện tại (id = 1)
   */
  async getLocation(): Promise<Location> {
    const location = await this.locationRepository.findOne({ where: { id: 1 } });
    if (!location) {
      // Tạo vị trí mặc định nếu chưa có
      return this.locationRepository.save({
        id: 1,
        name: 'Ruộng nhà ông Tư - Tân Lập, Vũ Thư',
        lat: 20.4167,
        lon: 106.3667,
      });
    }
    return location;
  }

  /**
   * Cập nhật vị trí (UPSERT với id = 1)
   */
  async updateLocation(dto: UpdateLocationDto): Promise<Location> {
    this.logger.log(`Cập nhật vị trí: ${dto.name} (${dto.lat}, ${dto.lon})`);
    
    let location = await this.locationRepository.findOne({ where: { id: 1 } });

    if (location) {
      await this.locationRepository.update(1, dto);
      location = await this.locationRepository.findOne({ where: { id: 1 } });
    } else {
      location = await this.locationRepository.save({
        id: 1,
        ...dto,
      });
    }

    if (!location) {
      throw new Error('Failed to update location');
    }

    // Sau khi cập nhật vị trí, chạy phân tích ngay
    await this.runAnalysis();

    return location;
  }

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
        probability: 0,
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
      // 1. Lấy vị trí hiện tại
      const location = await this.getLocation();
      this.logger.log(`📍 Vị trí: ${location.name} (${location.lat}, ${location.lon})`);

      // 2. Gọi API Open-Meteo để lấy dữ liệu thời tiết 7 ngày
      const weatherData = await this.fetchWeatherData(location.lat, location.lon);

      // 3. Tính toán nguy cơ bệnh từng ngày
      const dailyData = this.calculateDailyRisk(weatherData);

      // 4. Phân tích mức độ cảnh báo
      const analysis = this.analyzeRiskLevel(dailyData);

      // 5. Tạo tin nhắn cảnh báo
      const message = this.generateWarningMessage(analysis, location.name);

      // 6. Lưu kết quả vào database (UPSERT id = 1)
      // 6. Lưu kết quả vào database (UPSERT id = 1)
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
      const lwdHours = this.calculateLWD(temps, humidities, dewPoints);

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
   * Điều kiện: RH >= 90% VÀ Temp <= DewPoint + 1.0°C
   */
  private calculateLWD(temps: number[], humidities: number[], dewPoints: number[]): number {
    let lwdHours = 0;
    for (let i = 0; i < temps.length; i++) {
      if ((humidities[i] ?? 0) >= 90 && (temps[i] ?? 0) <= (dewPoints[i] ?? 0) + 1.0) {
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
   * Phân tích mức độ cảnh báo dựa trên dữ liệu 7 ngày
   */
  private analyzeRiskLevel(dailyData: DailyRiskData[]): {
    riskLevel: string;
    probability: number;
    peakDays: string;
    highRiskDays: DailyRiskData[];
  } {
    // Tìm ngày có điểm cao nhất
    const maxScore = Math.max(...dailyData.map(d => d.riskScore));
    const highRiskDays = dailyData.filter(d => d.riskScore >= 70).sort((a, b) => b.riskScore - a.riskScore);

    // Tính xác suất nhiễm bệnh
    const probability = Math.min(100, Math.round(maxScore * 0.9 + 15));

    // Xác định mức độ cảnh báo
    let riskLevel = 'AN TOÀN';
    let peakDays = '';

    // Quy tắc A: Có ít nhất 1 ngày >= 100 điểm → CẢNH BÁO ĐỎ
    if (dailyData.some(d => d.riskScore >= 100)) {
      riskLevel = 'RẤT CAO';
      const redDays = dailyData.filter(d => d.riskScore >= 100);
      peakDays = this.formatPeakDays(redDays);
    }
    // Quy tắc B: Có ít nhất 2 ngày liên tiếp >= 80 điểm → CẢNH BÁO SỚM
    else if (this.hasConsecutiveDays(dailyData, 80, 2)) {
      riskLevel = 'CAO';
      const orangeDays = dailyData.filter(d => d.riskScore >= 80);
      peakDays = this.formatPeakDays(orangeDays);
    }
    // Quy tắc C: Có ít nhất 3 ngày liên tiếp >= 70 điểm → CẢNH BÁO VÀNG
    else if (this.hasConsecutiveDays(dailyData, 70, 3)) {
      riskLevel = 'TRUNG BÌNH';
      const yellowDays = dailyData.filter(d => d.riskScore >= 70);
      peakDays = this.formatPeakDays(yellowDays);
    }
    // Nguy cơ thấp
    else if (maxScore >= 50) {
      riskLevel = 'THẤP';
    }

    return { riskLevel, probability, peakDays, highRiskDays };
  }

  /**
   * Kiểm tra có N ngày liên tiếp >= threshold không
   */
  private hasConsecutiveDays(dailyData: DailyRiskData[], threshold: number, count: number): boolean {
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
    analysis: { riskLevel: string; probability: number; peakDays: string; highRiskDays: DailyRiskData[] },
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

🧪 Hoạt chất khuyên dùng:
• Tricyclazole
• Tebuconazole + Trifloxystrobin
• Isoprothiolane
• Propineb + Kasugamycin

⏰ Phun vào sáng sớm (5–7h) hoặc chiều mát (16–18h)
💧 Dùng đủ nước (400–500 lít/ha) để thuốc phủ đều`;
    }

    if (riskLevel === 'CAO') {
      const avgLWD = Math.round(this.average(highRiskDays.map(d => d.lwdHours)));
      return `🟠 CẢNH BÁO SỚM – Nguy cơ đang tăng cao

📍 ${locationName}
⚠️ Dự báo 3–5 ngày tới có điều kiện thuận lợi (${peakDays})
🌧️ Lá ướt ${avgLWD} giờ + độ ẩm cao → nguy cơ lây nhiễm

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
