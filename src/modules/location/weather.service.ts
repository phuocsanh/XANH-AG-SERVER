import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as https from 'https';

/**
 * Interface cho dữ liệu thời tiết từ Open-Meteo API
 * Bao gồm tất cả các trường cần thiết cho cả 3 module phân tích
 */
export interface WeatherData {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    dew_point_2m: number[];
    precipitation: number[];
    cloud_cover_low: number[];
    cloud_cover: number[];
    visibility: number[];
    weather_code: number[];
    wind_speed_10m: number[];
  };
}

/**
 * Service chung để fetch dữ liệu thời tiết từ Open-Meteo API
 * Được sử dụng bởi tất cả các module cảnh báo bệnh/sâu hại
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  /**
   * Lấy dữ liệu thời tiết 7 ngày cho một vị trí
   * @param lat Vĩ độ
   * @param lon Kinh độ
   * @returns Dữ liệu thời tiết hourly 7 ngày
   */
  async fetchWeatherData(lat: number, lon: number): Promise<WeatherData> {
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
        'cloud_cover',
        'visibility',
        'weather_code',
        'wind_speed_10m',
      ].join(','),
      forecast_days: 7,
      timezone: 'Asia/Ho_Chi_Minh',
    };

    this.logger.log(`🌤️  Fetching weather data for (${lat}, ${lon})...`);
    
    try {
      // Force IPv4 to avoid Docker IPv6 resolution issues
      const agent = new https.Agent({ family: 4 });
      const response = await axios.get(url, { 
        params, 
        timeout: 10000,
        httpsAgent: agent
      });
      
      this.logger.log(`✅ Weather data fetched successfully`);
      return response.data;
    } catch (error) {
      this.logger.error(`❌ Failed to fetch weather data: ${error}`);
      throw new Error('Lỗi kết nối mạng hoặc API thời tiết không phản hồi. Vui lòng kiểm tra kết nối internet.');
    }
  }
}
