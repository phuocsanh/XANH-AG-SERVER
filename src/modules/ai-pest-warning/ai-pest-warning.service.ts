import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PestWarning, PestDailyRiskData } from '../../entities/pest-warning.entity';
import { LocationService } from '../location/location.service';
import axios from 'axios';
import * as https from 'https';

interface WeatherData {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    precipitation: number[];
    cloud_cover: number[];
  };
}

@Injectable()
export class AiPestWarningService {
  private readonly logger = new Logger(AiPestWarningService.name);

  constructor(
    @InjectRepository(PestWarning)
    private warningRepository: Repository<PestWarning>,
    private locationService: LocationService,
  ) {}

  async getWarning(): Promise<PestWarning> {
    const warning = await this.warningRepository.findOne({ where: { id: 1 } });
    if (!warning) {
      return this.warningRepository.save({
        id: 1,
        generated_at: new Date(),
        stem_borer_risk: 'ĐANG CHỜ CẬP NHẬT',
        gall_midge_risk: 'ĐANG CHỜ CẬP NHẬT',
        message: 'Hệ thống đang khởi động...',
        daily_data: [],
      });
    }
    return warning;
  }

  async runAnalysis(): Promise<PestWarning> {
    this.logger.log('🐛 Bắt đầu phân tích sâu hại...');

    try {
      const location = await this.locationService.getLocation();
      const weatherData = await this.fetchWeatherData(location.lat, location.lon);
      
      return this.runAnalysisWithWeatherData(weatherData);

    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi khi phân tích sâu hại: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Chạy phân tích với dữ liệu thời tiết đã có sẵn
   * Method này được gọi khi LocationService trigger phân tích cho nhiều module
   */
  async runAnalysisWithWeatherData(weatherData: any): Promise<PestWarning> {
    try {
      const location = await this.locationService.getLocation();
      
      const dailyData = this.calculateDailyRisk(weatherData);
      const analysis = this.analyzeRiskLevel(dailyData);
      const message = this.generateWarningMessage(analysis, location.name);

      const warningData = {
        generated_at: new Date(),
        stem_borer_risk: analysis.stemBorerLevel,
        gall_midge_risk: analysis.gallMidgeLevel,
        message: message,
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

      if (!warning) throw new Error('Failed to save warning');

      this.logger.log(`✅ Phân tích sâu hại hoàn tất`);
      return warning;

    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi khi phân tích sâu hại: ${err.message}`, err.stack);
      throw error;
    }
  }

  private async fetchWeatherData(lat: number, lon: number): Promise<WeatherData> {
    const url = 'https://api.open-meteo.com/v1/forecast';
    const params = {
      latitude: lat,
      longitude: lon,
      hourly: ['temperature_2m', 'relative_humidity_2m', 'precipitation', 'cloud_cover'].join(','),
      forecast_days: 7,
      timezone: 'Asia/Ho_Chi_Minh',
    };

    try {
      const agent = new https.Agent({ family: 4 });
      const response = await axios.get(url, { params, timeout: 10000, httpsAgent: agent });
      return response.data;
    } catch (error) {
      throw new Error('Lỗi kết nối API thời tiết');
    }
  }

  private calculateDailyRisk(weatherData: WeatherData): PestDailyRiskData[] {
    const hourly = weatherData.hourly;
    const dailyData: PestDailyRiskData[] = [];

    for (let day = 0; day < 7; day++) {
      const startIdx = day * 24;
      const endIdx = startIdx + 24;

      const temps = hourly.temperature_2m.slice(startIdx, endIdx);
      const humidities = hourly.relative_humidity_2m.slice(startIdx, endIdx);
      const rains = hourly.precipitation.slice(startIdx, endIdx);
      const clouds = hourly.cloud_cover.slice(startIdx, endIdx);

      const tempAvg = this.average(temps);
      const tempMin = Math.min(...temps);
      const tempMax = Math.max(...temps);
      const humidityAvg = this.average(humidities);
      const rainTotal = this.sum(rains);
      const cloudAvg = this.average(clouds);
      
      // Ước tính giờ nắng: Cloud cover càng thấp thì nắng càng nhiều
      // Giả sử: (100 - cloudAvg) / 100 * 12 giờ nắng
      const sunHours = Math.round(((100 - cloudAvg) / 100) * 12 * 10) / 10;

      // --- LOGIC TÍNH ĐIỂM SÂU ĐỤC THÂN ---
      let stemBorerScore = 0;
      // Nhiệt độ 25-30 là lý tưởng (40đ)
      if (tempAvg >= 25 && tempAvg <= 30) stemBorerScore += 40;
      else if (tempAvg >= 22 && tempAvg < 25) stemBorerScore += 20;
      
      // Độ ẩm > 80% (30đ)
      if (humidityAvg >= 80) stemBorerScore += 30;
      else if (humidityAvg >= 75) stemBorerScore += 15;

      // Nắng ấm xen kẽ mưa nhẹ (30đ)
      if (sunHours >= 4 && rainTotal > 0 && rainTotal < 10) stemBorerScore += 30;
      else if (sunHours >= 4) stemBorerScore += 15;


      // --- LOGIC TÍNH ĐIỂM MUỖI HÀNH ---
      let gallMidgeScore = 0;
      // Độ ẩm rất cao > 85% (50đ) - Quan trọng nhất
      if (humidityAvg >= 90) gallMidgeScore += 50;
      else if (humidityAvg >= 85) gallMidgeScore += 40;
      
      // Trời âm u, ít nắng (30đ)
      if (sunHours < 4 && cloudAvg > 70) gallMidgeScore += 30;
      
      // Nhiệt độ mát 23-28 (20đ)
      if (tempAvg >= 23 && tempAvg <= 28) gallMidgeScore += 20;

      // Xác định level
      const getLevel = (score: number) => {
        if (score >= 80) return 'CAO';
        if (score >= 50) return 'TRUNG BÌNH';
        return 'THẤP';
      };

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
        sunHours,
        stemBorerScore,
        gallMidgeScore,
        stemBorerLevel: getLevel(stemBorerScore),
        gallMidgeLevel: getLevel(gallMidgeScore),
      });
    }

    return dailyData;
  }

  private analyzeRiskLevel(dailyData: PestDailyRiskData[]): {
    stemBorerLevel: string;
    gallMidgeLevel: string;
    highRiskDaysStemBorer: string[];
    highRiskDaysGallMidge: string[];
  } {
    // Phân tích Sâu đục thân
    const maxStemScore = Math.max(...dailyData.map(d => d.stemBorerScore));
    let stemBorerLevel = 'THẤP';
    if (maxStemScore >= 80) stemBorerLevel = 'CAO';
    else if (maxStemScore >= 50) stemBorerLevel = 'TRUNG BÌNH';

    // Phân tích Muỗi hành
    const maxGallScore = Math.max(...dailyData.map(d => d.gallMidgeScore));
    let gallMidgeLevel = 'THẤP';
    if (maxGallScore >= 80) gallMidgeLevel = 'CAO';
    else if (maxGallScore >= 50) gallMidgeLevel = 'TRUNG BÌNH';

    const highRiskDaysStemBorer = dailyData.filter(d => d.stemBorerScore >= 50).map(d => d.date);
    const highRiskDaysGallMidge = dailyData.filter(d => d.gallMidgeScore >= 50).map(d => d.date);

    return { stemBorerLevel, gallMidgeLevel, highRiskDaysStemBorer, highRiskDaysGallMidge };
  }

  private generateWarningMessage(
    analysis: { stemBorerLevel: string; gallMidgeLevel: string; highRiskDaysStemBorer: string[]; highRiskDaysGallMidge: string[] },
    locationName: string,
  ): string {
    let msg = `📍 ${locationName}\n\n`;

    // Sâu đục thân
    if (analysis.stemBorerLevel === 'CAO') {
      msg += `🐛 SÂU ĐỤC THÂN: NGUY CƠ CAO\n`;
      msg += `⚠️ Thời tiết ấm ẩm, thuận lợi bướm đẻ trứng.\n`;
      msg += `👉 Khuyến cáo: Thăm đồng, kiểm tra mật độ bướm. Phun thuốc nếu bướm rộ.\n`;
      msg += `⏰ Thời điểm phun: Chiều tối 17:00-19:00 hoặc Sáng sớm 5:00-7:00 (khi bướm hoạt động)\n\n`;
    } else if (analysis.stemBorerLevel === 'TRUNG BÌNH') {
      msg += `🐛 Sâu đục thân: Nguy cơ Trung bình\n`;
      msg += `⚠️ Cần theo dõi thêm.\n\n`;
    } else {
      msg += `✅ Sâu đục thân: An toàn\n\n`;
    }

    // Muỗi hành
    if (analysis.gallMidgeLevel === 'CAO') {
      msg += `🦟 MUỖI HÀNH: NGUY CƠ CAO\n`;
      msg += `⚠️ Độ ẩm cao, trời âm u sương mù.\n`;
      msg += `👉 Khuyến cáo: Phun phòng ngay bằng thuốc lưu dẫn nếu lúa đang đẻ nhánh.\n`;
      msg += `⏰ Thời điểm phun: Chiều mát 16:00-18:00 (trước khi muỗi hoạt động vào đêm)`;
    } else if (analysis.gallMidgeLevel === 'TRUNG BÌNH') {
      msg += `🦟 Muỗi hành: Nguy cơ Trung bình\n`;
      msg += `⚠️ Chú ý nếu trời tiếp tục âm u.`;
    } else {
      msg += `✅ Muỗi hành: An toàn`;
    }

    // Lưu ý chung nếu có ít nhất 1 loại nguy cơ cao
    if (analysis.stemBorerLevel === 'CAO' || analysis.gallMidgeLevel === 'CAO') {
      msg += `\n\n🚫 LƯU Ý CHUNG:\n`;
      msg += `• Tránh phun buổi trưa nắng gắt (thuốc bay hơi nhanh)\n`;
      msg += `• Không phun khi trời sắp mưa (thuốc bị rửa trôi)`;
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
