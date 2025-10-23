import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { GoogleGenAI } from '@google/genai';
import {
  WeatherForecastResult,
  YouTubeVideoData,
  YouTubeSearchResult,
} from './interfaces/weather-forecast.interface';
import { WeatherForecast } from '../../entities/weather-forecast.entity';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Service dự báo thời tiết sử dụng Google Generative AI và tìm kiếm web thời gian thực
 * Phân tích mưa bão, mực nước ĐBSCL, và dự báo 10 ngày
 */
@Injectable()
export class WeatherForecastService {
  private readonly logger = new Logger(WeatherForecastService.name);
  private readonly genAI: GoogleGenAI;
  private readonly braveApiKey: string;
  private readonly braveApiUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(WeatherForecast)
    private readonly weatherForecastRepository: Repository<WeatherForecast>,
  ) {
    // Khởi tạo Google Generative AI
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY không được cấu hình');
    }
    this.genAI = new GoogleGenAI({ apiKey });

    // Khởi tạo Brave Search API
    this.braveApiKey =
      this.configService.get<string>('BRAVE_SEARCH_API_KEY') || '';
    this.braveApiUrl =
      this.configService.get<string>('BRAVE_SEARCH_API_URL') ||
      'https://api.search.brave.com/res/v1/web/search';

    if (!this.braveApiKey) {
      this.logger.warn(
        'BRAVE_SEARCH_API_KEY không được cấu hình. Vui lòng thêm API key vào file .env',
      );
    }

    this.logger.log('WeatherForecastService đã được khởi tạo');
  }

  /**
   * Cron job chạy tự động 2 lần mỗi ngày (7:00 sáng và 16:00 chiều)
   * để thu thập và lưu trữ dữ liệu dự báo thời tiết
   */
  @Cron('0 0 7,16 * * *')
  async handleCron() {
    this.logger.log('Bắt đầu chạy cron job thu thập dữ liệu thời tiết...');
    try {
      await this.fetchAndSaveFullForecast();
      this.logger.log('Cron job hoàn thành thành công');
    } catch (error) {
      this.logger.error('Lỗi khi chạy cron job:', error);
    }
  }

  /**
   * Thu thập dữ liệu thời tiết và lưu vào database (chỉ duy trì 1 bản ghi duy nhất)
   */
  async fetchAndSaveFullForecast(): Promise<WeatherForecast> {
    try {
      // Gọi phương thức phân tích thời tiết
      const result = await this.analyzeWeatherForecast();

      // Kiểm tra xem đã có bản ghi nào chưa
      const existingForecast = await this.weatherForecastRepository
        .createQueryBuilder('forecast')
        .orderBy('forecast.createdAt', 'DESC')
        .getOne();

      let weatherForecast: WeatherForecast;

      if (existingForecast) {
        // Nếu đã có bản ghi, cập nhật nó
        this.logger.log('Đã có bản ghi, cập nhật dữ liệu...');
        weatherForecast = existingForecast;
        weatherForecast.summary = result.summary;
        weatherForecast.hydrologyInfo = result.hydrologyInfo;
        weatherForecast.waterLevelInfo = result.waterLevelInfo;
        weatherForecast.stormsAndTropicalDepressionsInfo =
          result.stormsAndTropicalDepressionsInfo;
        weatherForecast.lastUpdated = new Date(result.lastUpdated);
        weatherForecast.dataSources = result.dataSources;
        weatherForecast.dataQuality = {
          reliability: 'high',
          sourcesUsed: result.dataSources.length,
          score: 90,
        };
      } else {
        // Nếu chưa có bản ghi, tạo mới
        this.logger.log('Chưa có bản ghi, tạo mới dữ liệu...');
        weatherForecast = new WeatherForecast();
        weatherForecast.summary = result.summary;
        weatherForecast.hydrologyInfo = result.hydrologyInfo;
        weatherForecast.waterLevelInfo = result.waterLevelInfo;
        weatherForecast.stormsAndTropicalDepressionsInfo =
          result.stormsAndTropicalDepressionsInfo;
        weatherForecast.lastUpdated = new Date(result.lastUpdated);
        weatherForecast.dataSources = result.dataSources;
        weatherForecast.dataQuality = {
          reliability: 'high',
          sourcesUsed: result.dataSources.length,
          score: 90,
        };
      }

      // Lưu vào database
      const savedForecast =
        await this.weatherForecastRepository.save(weatherForecast);
      this.logger.log(
        `Đã lưu dữ liệu thời tiết vào database với ID: ${savedForecast.id}`,
      );
      return savedForecast;
    } catch (error) {
      this.logger.error('Lỗi khi thu thập và lưu dữ liệu thời tiết:', error);
      throw error;
    }
  }

  /**
   * Lấy dữ liệu thời tiết mới nhất từ database
   */
  async getLatestForecast(): Promise<WeatherForecast | null> {
    try {
      const latestForecast = await this.weatherForecastRepository
        .createQueryBuilder('forecast')
        .orderBy('forecast.createdAt', 'DESC')
        .limit(1)
        .getOne();

      return latestForecast;
    } catch (error) {
      this.logger.error('Lỗi khi lấy dữ liệu thời tiết mới nhất:', error);
      throw error;
    }
  }

  /**
   * Tìm kiếm thông tin thời gian thực trên web sử dụng Brave Search API
   */
  private async searchWebRealTime(query: string): Promise<any[]> {
    try {
      this.logger.log(`Đang tìm kiếm thông tin: "${query}"`);

      if (!this.braveApiKey) {
        this.logger.warn('Brave Search API key không được cấu hình');
        return [];
      }

      // Thêm độ trễ 1.5 giây để tránh vượt quá rate limit
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const response = await axios.get(this.braveApiUrl, {
        params: {
          q: query,
          count: 10,
          offset: 0,
          mkt: 'vi-VN',
          safesearch: 'moderate',
          textDecorations: false,
          textFormat: 'Raw',
        },
        timeout: 10000,
        headers: {
          'X-Subscription-Token': this.braveApiKey,
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; GN-ARGI/1.0)',
        },
      });

      const data = response.data;
      const results: any[] = [];

      // Xử lý kết quả web
      if (data.web?.results && Array.isArray(data.web.results)) {
        data.web.results.forEach((result: any, index: number) => {
          results.push({
            title: result.title || 'Không có tiêu đề',
            snippet: result.description || 'Không có mô tả',
            url: result.url || '',
            source: result.profile?.name || 'Web',
            publishedDate: result.age || new Date().toISOString(),
            relevanceScore: 1.0 - index * 0.1,
          });
        });
      }

      // Xử lý kết quả tin tức
      if (data.news?.results && Array.isArray(data.news.results)) {
        data.news.results.forEach((result: any, index: number) => {
          results.push({
            title: result.title || 'Không có tiêu đề',
            snippet: result.description || 'Không có mô tả',
            url: result.url || '',
            source: result.profile?.name || 'News',
            publishedDate: result.age || new Date().toISOString(),
            relevanceScore: 0.9 - index * 0.1,
          });
        });
      }

      this.logger.log(`Tìm thấy ${results.length} kết quả từ Brave Search API`);
      return results;
    } catch (error: any) {
      this.logger.error(
        'Lỗi khi tìm kiếm với Brave Search API:',
        error.message,
      );
      return [];
    }
  }

  /**
   * Tìm kiếm video YouTube về dự báo thời tiết (public method cho controller)
   */
  async getYouTubeVideos(
    query: string,
    maxResults: number = 5,
  ): Promise<YouTubeSearchResult> {
    try {
      const videos = await this.searchYouTubeVideos(query, maxResults);

      // Tính toán chất lượng tìm kiếm
      const todayVideosCount = videos.filter(
        (video) =>
          video.uploadTime &&
          (video.uploadTime.includes('ngày trước') ||
            video.uploadTime.includes('giờ trước') ||
            video.uploadTime.includes('phút trước') ||
            video.uploadTime.includes('giờ') ||
            video.uploadTime.includes('phút')),
      ).length;

      const searchQuality = {
        hasRecentVideos: todayVideosCount > 0,
        todayVideosCount: todayVideosCount,
        score: Math.min(
          100,
          Math.round(
            (videos.length / maxResults) * 70 +
              (todayVideosCount / videos.length) * 30,
          ),
        ),
      };

      return {
        videos: videos,
        query: query,
        searchTime: new Date().toISOString(),
        totalResults: videos.length,
        searchQuality: searchQuality,
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi tìm kiếm YouTube videos:', error.message);
      return {
        videos: [],
        query: query,
        searchTime: new Date().toISOString(),
        totalResults: 0,
        searchQuality: {
          hasRecentVideos: false,
          todayVideosCount: 0,
          score: 0,
        },
        error: `Lỗi tìm kiếm YouTube: ${error.message}`,
      };
    }
  }

  /**
   * Tìm kiếm video YouTube về dự báo thời tiết (private method)
   */
  private async searchYouTubeVideos(
    query: string,
    maxResults: number = 3,
  ): Promise<YouTubeVideoData[]> {
    try {
      this.logger.log(`Đang tìm kiếm video YouTube: "${query}"`);

      // Sử dụng youtube-search-api package đã có trong project
      const youtubeSearch = require('youtube-search-api');
      const result = await youtubeSearch.GetListByKeyword(
        query,
        false,
        maxResults,
      );

      if (!result || !result.items || !Array.isArray(result.items)) {
        this.logger.warn('Không tìm thấy video YouTube nào');
        return [];
      }

      const videos: YouTubeVideoData[] = result.items.map((item: any) => ({
        id: item.id || '',
        title: item.title || 'Không có tiêu đề',
        url: `https://www.youtube.com/watch?v=${item.id}`,
        thumbnail: item.thumbnail?.thumbnails?.[0]?.url || '',
        channel: {
          name: item.channelTitle || 'Không rõ kênh',
          url: item.channelId
            ? `https://www.youtube.com/channel/${item.channelId}`
            : undefined,
        },
        duration: item.lengthText || 'Không rõ',
        views: item.viewCountText || 'Không rõ',
        uploadTime: item.publishedTime || 'Không rõ',
        description:
          item.descriptionSnippet || item.description || 'Không có mô tả',
      }));

      this.logger.log(`Tìm thấy ${videos.length} video YouTube`);
      return videos;
    } catch (error: any) {
      this.logger.error('Lỗi khi tìm kiếm YouTube:', error.message);
      return [];
    }
  }

  /**
   * Thu thập dữ liệu thời tiết từ nhiều nguồn
   */
  private async collectWeatherData(): Promise<{
    hydrologyData: string;
    waterLevelData: string;
    stormsAndTropicalDepressionsData: string;
    sources: string[];
  }> {
    try {
      this.logger.log('Bắt đầu thu thập dữ liệu thời tiết...');

      // Thu thập dữ liệu bão từ trang web dự báo khí hậu
      let hydrologyData = '';
      const stormSources: string[] = [];

      try {
        this.logger.log(
          'Đang thu thập dữ liệu bão từ https://nchmf.gov.vn/kttvsite/vi-VN/1/du-bao-khi-hau-10-15.html',
        );

        // Truy cập trang danh sách Bản tin dự báo khí hậu 10-15 ngày
        const listPageResponse = await axios.get(
          'https://nchmf.gov.vn/kttvsite/vi-VN/1/du-bao-khi-hau-10-15.html',
          {
            timeout: 15000,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
          },
        );

        const $list = cheerio.load(listPageResponse.data);

        // Tìm bài đầu tiên trong danh sách có tiêu đề liên quan đến bản tin dự báo khí hậu năm (không phân biệt chữ hoa thường)
        let firstArticleLink = '';
        let firstArticleTitle = '';

        // Duyệt qua tất cả các link để tìm bài viết phù hợp
        $list('a').each((_, element) => {
          const linkElement = $list(element);
          const href = linkElement.attr('href');
          const title = linkElement.text().trim();

          // Kiểm tra nếu tiêu đề chứa các từ khóa liên quan đến bản tin dự báo khí hậu năm
          if (
            href &&
            title &&
            title.toLowerCase().includes('bản tin dự báo khí hậu') &&
            title.toLowerCase().includes('thời hạn năm') &&
            title.toLowerCase().includes('phạm vi toàn quốc')
          ) {
            firstArticleLink = href;
            firstArticleTitle = title;
            this.logger.log(`Tìm thấy bài viết đầu tiên: ${title}`);
            return false; // break loop
          }
          return true; // continue loop
        });

        // Nếu không tìm thấy bài viết với tiêu đề chính xác, tìm bài viết gần giống nhất
        if (!firstArticleLink) {
          $list('a').each((_, element) => {
            const linkElement = $list(element);
            const href = linkElement.attr('href');
            const title = linkElement.text().trim();

            // Kiểm tra nếu tiêu đề chứa các từ khóa liên quan đến bản tin dự báo
            if (
              href &&
              title &&
              (title.toLowerCase().includes('bản tin dự báo') ||
                title.toLowerCase().includes('dự báo khí hậu') ||
                title.toLowerCase().includes('bản tin khí hậu'))
            ) {
              firstArticleLink = href;
              firstArticleTitle = title;
              this.logger.log(`Tìm thấy bài viết gần đúng: ${title}`);
              return false; // break loop
            }
            return true; // continue loop
          });
        }

        console.log(
          '🚀 ~ WeatherForecastService ~ collectWeatherData ~ firstArticleLink:',
          firstArticleLink,
        );
        if (firstArticleLink) {
          // Xây dựng URL đầy đủ của bài viết
          const articleUrl = firstArticleLink.startsWith('http')
            ? firstArticleLink
            : `https://nchmf.gov.vn${firstArticleLink.startsWith('/') ? firstArticleLink : '/' + firstArticleLink}`;

          this.logger.log(`Đang truy cập bài viết đầu tiên: ${articleUrl}`);

          // Truy cập chi tiết bài viết
          const articleResponse = await axios.get(articleUrl, {
            timeout: 15000,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
          });

          const $article = cheerio.load(articleResponse.data);

          // Trích xuất tiêu đề - thử nhiều selector khác nhau
          let title = '';
          const titleSelectors = [
            'h1.title-detail',
            'h1.title',
            'h1',
            '.title-detail',
            '.title',
            '.post-title',
            '.article-title',
            'title',
            'h1[class*="title"]',
            '.article-header h1',
            '.news-title',
            '.content-title',
          ];

          for (const selector of titleSelectors) {
            const titleElement = $article(selector).first();
            if (titleElement.length > 0 && titleElement.text().trim()) {
              title = titleElement.text().trim();
              if (title.length > 10) {
                // Đảm bảo tiêu đề có độ dài hợp lý
                this.logger.log(
                  `Tìm thấy tiêu đề với selector: ${selector} - "${title.substring(0, 50)}..."`,
                );
                break;
              }
            }
          }

          // Nếu không tìm thấy tiêu đề từ selector, sử dụng tiêu đề đã tìm được từ danh sách
          if ((!title || title.length < 10) && firstArticleTitle) {
            title = firstArticleTitle;
          }

          // Trích xuất nội dung chính - ƯU TIÊN thẻ div có class="text-content-news"
          let content = '';

          // Phương pháp 1: Ưu tiên lấy từ div có class="text-content-news"
          const primaryContentElement = $article('div.text-content-news');
          if (primaryContentElement.length > 0) {
            content = primaryContentElement.text().trim();
            this.logger.log(
              `Tìm thấy nội dung chính từ div.text-content-news - Độ dài: ${content.length}`,
            );
          }

          // Phương pháp 2: Nếu không tìm thấy, thử các selector phổ biến khác
          if (!content) {
            const contentSelectors = [
              '.detail-content',
              '.content-detail',
              '.post-content',
              '.article-content',
              '.content',
              '.description',
              '.summary',
              '.article-body',
              '.news-content',
              '.entry-content',
              '[class*="content"]',
              '[class*="article"]',
              '.main-content',
              '.post-body',
            ];

            for (const selector of contentSelectors) {
              const elements = $article(selector);
              if (elements.length > 0) {
                let tempContent = '';
                elements.each((_, el) => {
                  const text = $article(el).text().trim();
                  if (
                    text &&
                    text.length > 50 &&
                    !text.includes('Chi tiết tin') &&
                    !text.includes('THIÊN TAI NGUY HIỂM') &&
                    text.length < 10000
                  ) {
                    tempContent += text + '\n\n';
                  }
                });

                if (tempContent.length > 100) {
                  content = tempContent;
                  this.logger.log(
                    `Tìm thấy nội dung với selector: ${selector} - Độ dài: ${content.length}`,
                  );
                  break;
                }
              }
            }
          }

          // Phương pháp 3: Nếu không tìm thấy, thử lấy từ các thẻ p có nội dung
          if (!content) {
            const paragraphs = $article('p');
            let tempContent = '';
            paragraphs.each((_, el) => {
              const text = $article(el).text().trim();
              if (
                text &&
                text.length > 50 &&
                text.length < 5000 &&
                !text.includes('Chi tiết tin') &&
                !text.includes('THIÊN TAI NGUY HIỂM') &&
                !text.includes('Copyright') &&
                !text.includes('All rights reserved') &&
                !text.includes('Liên hệ') &&
                !text.includes('Đăng nhập') &&
                !text.includes('Tìm kiếm') &&
                !text.includes('Chia sẻ') &&
                !text.includes('Bình luận') &&
                !text.includes('>>') && // Loại bỏ navigation
                !text.includes('←') &&
                !text.includes('→')
              ) {
                tempContent += text + '\n\n';
              }
            });

            if (tempContent.length > 100) {
              content = tempContent;
              this.logger.log(
                `Lấy nội dung từ thẻ p - Độ dài: ${content.length}`,
              );
            }
          }

          // Làm sạch nội dung
          if (content) {
            // Loại bỏ các dòng trống nhiều lần
            content = content.replace(/\n{3,}/g, '\n\n');
            // Loại bỏ các khoảng trắng thừa
            content = content.replace(/^\s+|\s+$/gm, '');
            // Loại bỏ các đoạn lặp lại
            content = content.replace(/(Chi tiết tin\s*)+/g, '');
          }

          // Giới hạn độ dài content nhưng vẫn giữ đủ thông tin
          if (content && content.length > 5000) {
            content = content.substring(0, 5000) + '...';
          }

          if (title || content) {
            hydrologyData = `Tiêu đề: ${title || 'Không có tiêu đề'}
Nội dung: ${content || 'Không có nội dung'}
URL: ${articleUrl}
---`;
            console.log(
              '🚀 ~ WeatherForecastService ~ collectWeatherData ~ hydrologyData:',
              hydrologyData,
            );

            stormSources.push('Trung tâm Dự báo Khí tượng Thủy văn Quốc gia');
            this.logger.log(
              `✅ Thu thập dữ liệu bão thành công. Độ dài nội dung: ${content?.length || 0} ký tự`,
            );
          } else {
            this.logger.warn(
              '❌ Không tìm thấy tiêu đề hoặc nội dung bài viết',
            );
          }
        } else {
          this.logger.warn(
            'Không tìm thấy bài viết nào trong danh sách dự báo khí hậu',
          );
        }
      } catch (scrapingError) {
        this.logger.error('Lỗi khi scrape dữ liệu bão:', scrapingError);
      }

      // Thu thập dữ liệu mực nước ĐBSCL từ trang dự báo hạn dài
      let waterLevelData = '';
      const waterLevelSources: string[] = [];

      try {
        this.logger.log(
          'Đang thu thập dữ liệu mực nước ĐBSCL từ https://www.nchmf.gov.vn/kttv/vi-VN/1/du-bao-han-dai-2076-18.html',
        );

        // Truy cập trang danh sách Bản tin dự báo hạn dài
        const waterListPageResponse = await axios.get(
          'https://www.nchmf.gov.vn/kttv/vi-VN/1/du-bao-han-dai-2076-18.html',
          {
            timeout: 15000,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
          },
        );

        const $waterList = cheerio.load(waterListPageResponse.data);

        // Tìm bài đầu tiên trong danh sách có chứa "DỰ BÁO THỦY VĂN THỜI HẠN DÀI"
        let firstWaterArticleLink = '';
        let firstWaterArticleTitle = '';

        // Duyệt qua tất cả các link để tìm bài viết phù hợp
        $waterList('a').each((_, element) => {
          const linkElement = $waterList(element);
          const href = linkElement.attr('href');
          const title = linkElement.text().trim();

          // Kiểm tra nếu tiêu đề chứa cụm từ "DỰ BÁO THỦY VĂN THỜI HẠN DÀI" (không phân biệt chữ hoa thường)
          if (
            href &&
            title &&
            title.toLowerCase().includes('dự báo thủy văn thời hạn dài')
          ) {
            firstWaterArticleLink = href;
            firstWaterArticleTitle = title;
            this.logger.log(`Tìm thấy bài viết đầu tiên về thủy văn: ${title}`);
            return false; // break loop
          }
          return true; // continue loop
        });

        // Nếu không tìm thấy bài viết với tiêu đề chính xác, tìm bài viết gần giống nhất
        if (!firstWaterArticleLink) {
          $waterList('a').each((_, element) => {
            const linkElement = $waterList(element);
            const href = linkElement.attr('href');
            const title = linkElement.text().trim();

            // Kiểm tra nếu tiêu đề chứa các từ khóa liên quan đến thủy văn
            if (
              href &&
              title &&
              (title.toLowerCase().includes('thủy văn') ||
                title.toLowerCase().includes('mực nước') ||
                title.toLowerCase().includes('đbscl') ||
                title.toLowerCase().includes('đồng bằng sông cửu long'))
            ) {
              firstWaterArticleLink = href;
              firstWaterArticleTitle = title;
              this.logger.log(
                `Tìm thấy bài viết gần đúng về thủy văn: ${title}`,
              );
              return false; // break loop
            }
            return true; // continue loop
          });
        }

        if (firstWaterArticleLink) {
          // Xây dựng URL đầy đủ của bài viết
          const waterArticleUrl = firstWaterArticleLink.startsWith('http')
            ? firstWaterArticleLink
            : `https://www.nchmf.gov.vn${firstWaterArticleLink.startsWith('/') ? firstWaterArticleLink : '/' + firstWaterArticleLink}`;

          this.logger.log(
            `Đang truy cập bài viết thủy văn đầu tiên: ${waterArticleUrl}`,
          );

          // Truy cập chi tiết bài viết
          const waterArticleResponse = await axios.get(waterArticleUrl, {
            timeout: 15000,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
          });

          const $waterArticle = cheerio.load(waterArticleResponse.data);

          // Trích xuất tiêu đề
          let waterTitle = '';
          const titleSelectors = [
            'h1.title-detail',
            'h1.title',
            'h1',
            '.title-detail',
            '.title',
            '.post-title',
            '.article-title',
            'title',
            'h1[class*="title"]',
            '.article-header h1',
            '.news-title',
            '.content-title',
          ];

          for (const selector of titleSelectors) {
            const titleElement = $waterArticle(selector).first();
            if (titleElement.length > 0 && titleElement.text().trim()) {
              waterTitle = titleElement.text().trim();
              if (waterTitle.length > 10) {
                this.logger.log(
                  `Tìm thấy tiêu đề thủy văn với selector: ${selector} - "${waterTitle.substring(0, 50)}..."`,
                );
                break;
              }
            }
          }

          // Nếu không tìm thấy tiêu đề từ selector, sử dụng tiêu đề đã tìm được từ danh sách
          if (
            (!waterTitle || waterTitle.length < 10) &&
            firstWaterArticleTitle
          ) {
            waterTitle = firstWaterArticleTitle;
          }

          // Trích xuất nội dung chính liên quan đến thủy văn, ĐBSCL, miền Nam
          let waterContent = '';

          // Phương pháp 1: Ưu tiên lấy từ div có class="text-content-news"
          const primaryContentElement = $waterArticle('div.text-content-news');
          if (primaryContentElement.length > 0) {
            waterContent = primaryContentElement.text().trim();
            this.logger.log(
              `Tìm thấy nội dung thủy văn từ div.text-content-news - Độ dài: ${waterContent.length}`,
            );
          }

          // Phương pháp 2: Nếu không tìm thấy, thử các selector phổ biến khác
          if (!waterContent) {
            const contentSelectors = [
              '.detail-content',
              '.content-detail',
              '.post-content',
              '.article-content',
              '.content',
              '.description',
              '.summary',
              '.article-body',
              '.news-content',
              '.entry-content',
              '[class*="content"]',
              '[class*="article"]',
              '.main-content',
              '.post-body',
            ];

            for (const selector of contentSelectors) {
              const elements = $waterArticle(selector);
              if (elements.length > 0) {
                let tempContent = '';
                elements.each((_, el) => {
                  const text = $waterArticle(el).text().trim();
                  if (
                    text &&
                    text.length > 50 &&
                    !text.includes('Chi tiết tin') &&
                    !text.includes('THIÊN TAI NGUY HIỂM') &&
                    text.length < 10000
                  ) {
                    tempContent += text + '\n\n';
                  }
                });

                if (tempContent.length > 100) {
                  waterContent = tempContent;
                  this.logger.log(
                    `Tìm thấy nội dung thủy văn với selector: ${selector} - Độ dài: ${waterContent.length}`,
                  );
                  break;
                }
              }
            }
          }

          // Phương pháp 3: Nếu không tìm thấy, thử lấy từ các thẻ p có nội dung
          if (!waterContent) {
            const paragraphs = $waterArticle('p');
            let tempContent = '';
            paragraphs.each((_, el) => {
              const text = $waterArticle(el).text().trim();
              if (
                text &&
                text.length > 50 &&
                text.length < 5000 &&
                !text.includes('Chi tiết tin') &&
                !text.includes('THIÊN TAI NGUY HIỂM') &&
                !text.includes('Copyright') &&
                !text.includes('All rights reserved') &&
                !text.includes('Liên hệ') &&
                !text.includes('Đăng nhập') &&
                !text.includes('Tìm kiếm') &&
                !text.includes('Chia sẻ') &&
                !text.includes('Bình luận') &&
                !text.includes('>>') && // Loại bỏ navigation
                !text.includes('←') &&
                !text.includes('→')
              ) {
                tempContent += text + '\n\n';
              }
            });

            if (tempContent.length > 100) {
              waterContent = tempContent;
              this.logger.log(
                `Lấy nội dung thủy văn từ thẻ p - Độ dài: ${waterContent.length}`,
              );
            }
          }

          // Làm sạch nội dung
          if (waterContent) {
            // Loại bỏ các dòng trống nhiều lần
            waterContent = waterContent.replace(/\n{3,}/g, '\n\n');
            // Loại bỏ các khoảng trắng thừa
            waterContent = waterContent.replace(/^\s+|\s+$/gm, '');
            // Loại bỏ các đoạn lặp lại
            waterContent = waterContent.replace(/(Chi tiết tin\s*)+/g, '');
          }

          // Giới hạn độ dài content nhưng vẫn giữ đủ thông tin
          if (waterContent && waterContent.length > 5000) {
            waterContent = waterContent.substring(0, 5000) + '...';
          }

          if (waterTitle || waterContent) {
            waterLevelData = `Tiêu đề: ${waterTitle || 'Không có tiêu đề'}
Nội dung: ${waterContent || 'Không có nội dung'}
URL: ${waterArticleUrl}
---`;

            waterLevelSources.push(
              'Trung tâm Dự báo Khí tượng Thủy văn Quốc gia',
            );
            this.logger.log(
              `✅ Thu thập dữ liệu thủy văn thành công. Độ dài nội dung: ${waterContent?.length || 0} ký tự`,
            );
          } else {
            this.logger.warn(
              '❌ Không tìm thấy tiêu đề hoặc nội dung bài viết thủy văn',
            );
          }
        } else {
          this.logger.warn(
            'Không tìm thấy bài viết nào trong danh sách dự báo hạn dài về thủy văn',
          );
        }
      } catch (waterScrapingError) {
        this.logger.error(
          'Lỗi khi scrape dữ liệu thủy văn:',
          waterScrapingError,
        );
      }

      // Tìm kiếm dự báo thời tiết 10 ngày
      const forecastQueries = ['dự báo bão áp thấp nhiệt đới'];

      let stormsAndTropicalDepressionsData = '';
      const forecastSources: string[] = [];

      for (const query of forecastQueries) {
        const results = await this.searchWebRealTime(query);
        if (results.length > 0) {
          stormsAndTropicalDepressionsData += results
            .slice(0, 5)
            .map(
              (r) =>
                `Tiêu đề: ${r.title}
Nội dung: ${r.snippet}
Nguồn: ${r.source}
URL: ${r.url}
---`,
            )
            .join('\n');
          forecastSources.push(...results.slice(0, 5).map((r) => r.source));
        }
      }

      const allSources = [
        ...new Set([...stormSources, ...waterLevelSources, ...forecastSources]),
      ];

      // Nếu không có dữ liệu, cung cấp dữ liệu mẫu

      this.logger.log(`Đã thu thập dữ liệu từ ${allSources.length} nguồn`);

      return {
        hydrologyData,
        waterLevelData,
        stormsAndTropicalDepressionsData,
        sources: allSources,
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi thu thập dữ liệu thời tiết:', error);
      // Trả về dữ liệu mẫu khi có lỗi
      return {
        hydrologyData: ``,
        waterLevelData: ``,
        stormsAndTropicalDepressionsData: ``,
        sources: ['Trung tâm Dự báo Khí tượng Thủy văn Quốc gia'],
      };
    }
  }

  /**
   * Phân tích thời tiết bằng AI
   */
  async analyzeWeatherForecast(): Promise<WeatherForecastResult> {
    try {
      this.logger.log('Bắt đầu phân tích dự báo thời tiết...');

      // Thu thập dữ liệu
      const {
        hydrologyData,
        waterLevelData,
        stormsAndTropicalDepressionsData,
        sources,
      } = await this.collectWeatherData();

      // Tìm kiếm video YouTube
      const youtubeVideos = await this.searchYouTubeVideos(
        'dự báo thời tiết Việt Nam',
        5,
      );

      // Tạo prompt cho AI với dữ liệu thực tế
      const prompt = `
Bạn là chuyên gia khí tượng thủy văn. Hãy phân tích thông tin thời tiết sau và trả về JSON CHÍNH XÁC:

1. THÔNG TIN MƯA BÃO:
${hydrologyData || 'Không có dữ liệu mưa bão'}

2. THÔNG TIN MỰC NƯỚC ĐỒNG BẰNG SÔNG CỬU LONG, Nam Bộ:
${waterLevelData || 'Không có dữ liệu mực nước'}

3. DỰ BÁO THỜI Bão, Áp Thấp Nhiệt Đới:
${stormsAndTropicalDepressionsData || 'Không có dữ liệu dự báo'}

YÊU CẦU PHÂN TÍCH:\
1. Dự báo có bão/áp thấp nhiệt đới không
2. Tình hình mưa bão hiện tại và dự báo (trả về dưới dạng text tóm tắt)
3. Mực nước năm nay so với năm trước và trung bình nhiều năm  
4. Cảnh báo cho khu vực Đồng bằng sông Cửu Long
5. Khuyến cáo cho người dân và nông dân

QUAN TRỌNG:
- Chỉ sử dụng thông tin từ dữ liệu được cung cấp
- Không tự tạo thông tin không có trong dữ liệu
- Trích dẫn nguồn khi cần thiết
- Trả lời bằng tiếng Việt
- Dùng từ ngữ đơn giản, dễ hiểu không dùng từ viết tắt

BẮT BUỘC: Trả về JSON theo format chính xác sau (không thêm text ngoài JSON):
{
  "summary": "Tóm tắt thông tin quan trọng từ stormsAndTropicalDepressionsInfo, hydrologyInfo, waterLevelInfo dùng từ ngữ đơn giản dễ hiểu cho nông dân dễ hiểu, chủ yếu những thông tin nào ảnh hưởng đế trồng lúa ",
  "stormsAndTropicalDepressions": "Dự báo bão áp thấp Nhiệt đới"
  "hydrologyInfo": "Text tóm tắt thông tin khí hậu từ hydrologyData, không tóm tắt phần ENSO. (ATNĐ => Áp thấp nhiệt đới, TBNN => Trung bình năm ngoái),
  "waterLevelInfo": "Text tóm tắt thông tin thủy văn của Đông Bằng sông Cửu Long và Nam Bộ từ waterLevelInfo. (BĐ1 là Báo động 1, BĐ2 là Báo động 2, BĐ3 là Báo động 3..., ghi rõ ra đừng ghi viết tắt)",
}
      `;

      // Lấy model từ config hoặc dùng model mặc định
      const selectedModel =
        this.configService.get<string>('GOOGLE_AI_MODEL') ||
        'gemini-2.0-flash-exp';

      const result = await this.genAI.models.generateContent({
        model: selectedModel!,
        contents: prompt,
        config: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        },
      });

      const analysisResult = result.text || '';
      if (!analysisResult) {
        throw new Error('AI không thể tạo phân tích từ dữ liệu');
      }

      // Log phản hồi từ AI để debug
      this.logger.log(
        'AI Response nhận được:',
        analysisResult.substring(0, 500) + '...',
      );

      // Parse JSON response - cải thiện xử lý lỗi
      let parsedResult: any;
      try {
        let cleanedResult = analysisResult
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        // Tìm JSON object trong response
        const jsonMatch = cleanedResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanedResult = jsonMatch[0];
        }

        parsedResult = JSON.parse(cleanedResult);
        this.logger.log('Parse JSON thành công');
      } catch (parseError: any) {
        this.logger.error('Lỗi parse JSON:', parseError.message);
        this.logger.error(
          'Raw AI response (first 1000 chars):',
          analysisResult.substring(0, 1000),
        );

        // Thử parse với strategy khác - tìm JSON bắt đầu từ {
        try {
          const jsonStart = analysisResult.indexOf('{');
          const jsonEnd = analysisResult.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            const jsonStr = analysisResult.substring(jsonStart, jsonEnd + 1);
            parsedResult = JSON.parse(jsonStr);
            this.logger.log('Parse JSON thành công với strategy thứ 2');
          } else {
            throw new Error('Không tìm thấy JSON hợp lệ');
          }
        } catch (secondParseError: any) {
          this.logger.error('Lỗi parse JSON lần 2:', secondParseError.message);
          // Nếu vẫn không parse được, tạo kết quả mặc định với dữ liệu thực tế
          parsedResult = {
            summary: 'Không thể phân tích chi tiết từ dữ liệu thu thập được',
            hydrologyInfo: 'Không có thông tin về khí hậu',
            waterLevelInfo: 'Không có dữ liệu mực nước',
            stormsAndTropicalDepressionsInfo:
              'Không có dữ liệu dự báo bão, ap thấp nhiệt đới',
          };
        }
      }

      // Kết hợp kết quả AI với dữ liệu thực tế
      const finalResult: WeatherForecastResult = {
        summary: parsedResult.summary || 'Phân tích thời tiết từ AI',
        stormsAndTropicalDepressionsInfo:
          parsedResult.stormsAndTropicalDepressionsInfo || '',

        hydrologyInfo: parsedResult.hydrologyInfo || '',
        waterLevelInfo: parsedResult.waterLevelInfo || '',
        youtubeVideos: youtubeVideos,
        lastUpdated: new Date().toISOString(),
        dataSources:
          sources.length > 0
            ? sources
            : ['Trung tâm Dự báo Khí tượng Thủy văn Quốc gia'],
      };

      this.logger.log('Phân tích dự báo thời tiết hoàn thành');
      return finalResult;
    } catch (error: any) {
      this.logger.error('Lỗi khi phân tích dự báo thời tiết:', error);
      throw new Error(`Không thể phân tích dự báo thời tiết: ${error.message}`);
    }
  }
}
