import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';

/**
 * Interface cho kết quả search từ Brave Search API
 */
export interface SearchResult {
  title: string;
  url: string;
  description: string;
  published_date?: string;
  thumbnail?: string;
}

/**
 * Interface cho response từ Brave Search API
 */
interface BraveSearchResponse {
  web?: {
    results: Array<{
      title: string;
      url: string;
      description: string;
      published_date?: string;
      thumbnail?: {
        src: string;
      };
    }>;
  };
  news?: {
    results: Array<{
      title: string;
      url: string;
      description: string;
      published_date?: string;
      thumbnail?: {
        src: string;
      };
    }>;
  };
}

/**
 * Service để thực hiện web search sử dụng Brave Search API
 * Cung cấp khả năng tìm kiếm thông tin real-time cho AI
 */
@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);
  private readonly braveApiKey: string;
  private readonly baseUrl = 'https://api.search.brave.com/res/v1';

  constructor(private readonly configService: ConfigService) {
    this.braveApiKey = this.configService.get<string>('BRAVE_SEARCH_API_KEY') || '';
    if (!this.braveApiKey) {
      this.logger.warn('BRAVE_SEARCH_API_KEY không được cấu hình - web search sẽ không khả dụng');
    }
  }

  /**
   * Thực hiện web search với query
   * @param query - Từ khóa tìm kiếm
   * @param count - Số lượng kết quả tối đa (mặc định 10)
   * @param includeNews - Có bao gồm tin tức không (mặc định true)
   * @returns Promise<SearchResult[]> - Danh sách kết quả tìm kiếm
   */
  async searchWeb(
    query: string,
    count: number = 10,
    includeNews: boolean = true,
  ): Promise<SearchResult[]> {
    if (!this.braveApiKey) {
      throw new Error('Brave Search API key không được cấu hình');
    }

    try {
      this.logger.log(`Đang tìm kiếm: "${query}" (${count} kết quả)`);

      const params = new URLSearchParams({
        q: query,
        count: Math.min(count, 20).toString(), // Brave API giới hạn tối đa 20
        search_lang: 'vi', // Ưu tiên tiếng Việt
        country: 'VN', // Ưu tiên kết quả từ Việt Nam
        safesearch: 'moderate',
        freshness: 'pw', // Past week để có thông tin mới nhất
      });

      // Thêm news search nếu được yêu cầu
      if (includeNews) {
        params.append('result_filter', 'web,news');
      }

      const response: AxiosResponse<BraveSearchResponse> = await axios.get(
        `${this.baseUrl}/web/search`,
        {
          params,
          headers: {
            'X-Subscription-Token': this.braveApiKey,
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
          },
          timeout: 10000, // 10 giây timeout
        },
      );

      const results: SearchResult[] = [];

      // Xử lý kết quả web search
      if (response.data.web?.results) {
        for (const result of response.data.web.results) {
          const searchResult: SearchResult = {
            title: result.title,
            url: result.url,
            description: result.description,
          };
          
          if (result.published_date) {
            searchResult.published_date = result.published_date;
          }
          
          if (result.thumbnail?.src) {
            searchResult.thumbnail = result.thumbnail.src;
          }
          
          results.push(searchResult);
        }
      }

      // Xử lý kết quả news search
      if (response.data.news?.results && includeNews) {
        for (const result of response.data.news.results) {
          const searchResult: SearchResult = {
            title: `[TIN TỨC] ${result.title}`,
            url: result.url,
            description: result.description,
          };
          
          if (result.published_date) {
            searchResult.published_date = result.published_date;
          }
          
          if (result.thumbnail?.src) {
            searchResult.thumbnail = result.thumbnail.src;
          }
          
          results.push(searchResult);
        }
      }

      this.logger.log(`Tìm thấy ${results.length} kết quả cho query: "${query}"`);
      return results.slice(0, count); // Giới hạn theo số lượng yêu cầu

    } catch (error: any) {
      this.logger.error(`Lỗi khi search web cho query "${query}":`, error.message);
      
      if (error.response?.status === 429) {
        throw new Error('Đã vượt quá giới hạn API calls cho Brave Search');
      } else if (error.response?.status === 401) {
        throw new Error('API key Brave Search không hợp lệ');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Timeout khi gọi Brave Search API');
      }
      
      throw new Error(`Lỗi web search: ${error.message}`);
    }
  }

  /**
   * Tìm kiếm thông tin cụ thể về thị trường lúa gạo
   * @param topic - Chủ đề cần tìm (giá lúa, xuất khẩu, thời tiết, etc.)
   * @returns Promise<SearchResult[]> - Kết quả tìm kiếm liên quan đến lúa gạo
   */
  async searchRiceMarketInfo(topic: string): Promise<SearchResult[]> {
    const riceKeywords = [
      'lúa gạo Việt Nam',
      'giá lúa',
      'thị trường lúa gạo',
      'xuất khẩu gạo',
      'nông nghiệp Việt Nam',
    ];

    // Tạo query kết hợp topic với từ khóa lúa gạo
    const query = `${topic} ${riceKeywords[0]}`;
    
    return this.searchWeb(query, 8, true);
  }

  /**
   * Tìm kiếm tin tức mới nhất về lúa gạo
   * @returns Promise<SearchResult[]> - Tin tức mới nhất về lúa gạo
   */
  async searchLatestRiceNews(): Promise<SearchResult[]> {
    const newsQueries = [
      'tin tức lúa gạo Việt Nam hôm nay',
      'giá lúa mới nhất',
      'xuất khẩu gạo Việt Nam tin tức',
      'thị trường lúa gạo tuần này',
    ];

    const randomQuery = newsQueries[Math.floor(Math.random() * newsQueries.length)];
    if (!randomQuery) {
      throw new Error('Không thể tạo query ngẫu nhiên');
    }
    return this.searchWeb(randomQuery, 6, true);
  }

  /**
   * Kiểm tra trạng thái API key
   * @returns Promise<boolean> - True nếu API key hợp lệ
   */
  async checkApiStatus(): Promise<boolean> {
    if (!this.braveApiKey) {
      return false;
    }

    try {
      await this.searchWeb('test', 1, false);
      return true;
    } catch (error) {
      this.logger.error('API key Brave Search không hợp lệ:', error);
      return false;
    }
  }
}