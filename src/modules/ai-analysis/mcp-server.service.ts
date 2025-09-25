import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetch } from './undici-wrapper';
import * as cheerio from 'cheerio';
import { YouTubeSearchResult, YouTubeVideoData } from './interfaces/rice-analysis.interface';
// Sử dụng Brave Search API - cần API key
import axios from 'axios';

/**
 * MCP (Model Context Protocol) Server Service
 * Cung cấp tích hợp MCP Server cho AI Analysis Service
 * Thay thế WebSearchService với khả năng mở rộng tốt hơn
 * Tích hợp tìm kiếm web thời gian thực sử dụng Brave Search API
 */
@Injectable()
export class McpServerService {
  private readonly logger = new Logger(McpServerService.name);
  private readonly braveApiKey: string;
  private readonly braveApiUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Lấy cấu hình Brave Search API từ environment variables
    this.braveApiKey = this.configService.get<string>('BRAVE_SEARCH_API_KEY') || '';
    this.braveApiUrl = this.configService.get<string>('BRAVE_SEARCH_API_URL') || 'https://api.search.brave.com/res/v1/web/search';
    
    if (!this.braveApiKey) {
      this.logger.warn('BRAVE_SEARCH_API_KEY không được cấu hình. Vui lòng thêm API key vào file .env');
    }
    
    this.logger.log('Khởi tạo McpServerService với Brave Search API');
  }

  /**
   * Tìm kiếm thông tin thời gian thực trên web sử dụng Brave Search API
   * @param query - Từ khóa tìm kiếm
   * @returns Promise<any> - Kết quả tìm kiếm với nguồn trích dẫn
   */
  async searchWebRealTime(query: string): Promise<any> {
    try {
      this.logger.log(`Đang tìm kiếm thông tin thời gian thực với Brave Search API: "${query}"`);
      
      if (!this.braveApiKey) {
        throw new Error('Brave Search API key không được cấu hình');
      }
      
      // Gọi Brave Search API
      const response = await axios.get(this.braveApiUrl, {
        params: {
          q: query,
          count: 10,
          offset: 0,
          mkt: 'vi-VN',
          safesearch: 'moderate',
          textDecorations: false,
          textFormat: 'Raw'
        },
        timeout: 10000,
        headers: {
          'X-Subscription-Token': this.braveApiKey,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; GN-ARGI/1.0)'
        }
      });

      const data = response.data;
      
      // Khởi tạo mảng sources với kiểu dữ liệu rõ ràng
      const sources: Array<{
        id: number;
        title: string;
        url: string;
        snippet: string;
        domain: string;
        position: number;
        relevanceScore: number;
        type: string;
      }> = [];
      
      // Xử lý kết quả web từ Brave Search API
      if (data.web && data.web.results && Array.isArray(data.web.results)) {
        data.web.results.forEach((result: any, index: number) => {
          sources.push({
            id: index + 1,
            title: result.title || 'Không có tiêu đề',
            url: result.url || '',
            snippet: result.description || 'Không có mô tả',
            domain: result.profile?.name || 'Web',
            position: index + 1,
            relevanceScore: 1.0 - (index * 0.1),
            type: 'web'
          });
        });
      }

      // Xử lý kết quả tin tức nếu có
      if (data.news && data.news.results && Array.isArray(data.news.results)) {
        data.news.results.forEach((result: any, index: number) => {
          sources.push({
            id: sources.length + index + 1,
            title: result.title || 'Không có tiêu đề',
            url: result.url || '',
            snippet: result.description || 'Không có mô tả',
            domain: result.profile?.name || 'News',
            position: sources.length + index + 1,
            relevanceScore: 0.9 - (index * 0.1),
            type: 'news'
          });
        });
      }

      this.logger.log(`Tìm thấy ${sources.length} kết quả từ Brave Search API`);
      
      return {
        query: query,
        sources: sources,
        totalResults: sources.length,
        searchEngine: 'Brave Search API',
        timestamp: new Date().toISOString(),
        hasResults: sources.length > 0
      };

    } catch (error: any) {
      this.logger.error('Lỗi khi tìm kiếm với Brave Search API:', error.message);
      return {
        query: query,
        sources: [],
        totalResults: 0,
        searchEngine: 'Brave Search API',
        timestamp: new Date().toISOString(),
        error: error.message,
        hasResults: false
      };
    }
  }

  /**
   * Tìm kiếm tin tức về giá lúa gạo từ nhiều nguồn sử dụng Brave Search API
   * @param query - Từ khóa tìm kiếm (mặc định: "giá lúa gạo hôm nay")
   * @returns Promise<any> - Kết quả tìm kiếm tin tức với thông tin chi tiết
   */
  async searchRiceNewsMultiSource(query: string = "giá lúa gạo hôm nay"): Promise<any> {
    try {
      this.logger.log(`Đang tìm kiếm tin tức về giá lúa gạo với Brave Search API: "${query}"`);
      
      if (!this.braveApiKey) {
        throw new Error('Brave Search API key không được cấu hình');
      }
      
      // Gọi Brave Search API
      const response = await axios.get(this.braveApiUrl, {
        params: {
          q: query,
          count: 20,
          offset: 0,
          mkt: 'vi-VN',
          safesearch: 'moderate',
          textDecorations: false,
          textFormat: 'Raw'
        },
        timeout: 10000,
        headers: {
          'X-Subscription-Token': this.braveApiKey,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; GN-ARGI/1.0)'
        }
      });

      const data = response.data;
      
      // Xử lý kết quả từ Brave Search API
      const results: any[] = [];
      
      // Xử lý kết quả web
      if (data.web && data.web.results && Array.isArray(data.web.results)) {
        data.web.results.forEach((result: any, index: number) => {
          results.push({
            title: result.title || 'Thông tin về giá lúa gạo',
            snippet: result.description || 'Không có mô tả',
            url: result.url || '',
            source: result.profile?.name || 'Web',
            type: 'web',
            publishedDate: result.age || new Date().toISOString(),
            relevanceScore: 1.0 - (index * 0.05)
          });
        });
      }

      // Xử lý kết quả tin tức nếu có
      if (data.news && data.news.results && Array.isArray(data.news.results)) {
        data.news.results.forEach((result: any, index: number) => {
          results.push({
            title: result.title || 'Tin tức về giá lúa gạo',
            snippet: result.description || 'Không có mô tả',
            url: result.url || '',
            source: result.profile?.name || 'News',
            type: 'news',
            publishedDate: result.age || new Date().toISOString(),
            relevanceScore: 0.9 - (index * 0.05)
          });
        });
      }

      const newsResults = {
        query: query,
        searchTime: new Date().toISOString(),
        totalResults: results.length,
        sources: results.map((item: any, index: number) => ({
          id: index + 1,
          title: item.title,
          url: item.url,
          snippet: item.snippet || 'Không có mô tả',
          source: item.source,
          date: item.publishedDate,
          thumbnail: null
        })),
        articles: results,
        searchEngine: 'Brave Search API'
      };

      this.logger.log(`Tìm thấy ${results.length} tin tức từ Brave Search API`);
      return newsResults;

    } catch (error: any) {
      this.logger.error('Lỗi khi tìm kiếm tin tức với Brave Search API:', error.message);
      
      return {
        query: query,
        searchTime: new Date().toISOString(),
        totalResults: 0,
        sources: [],
        articles: [],
        searchEngine: 'Brave Search API',
        error: error.message
      };
    }
  }

  /**
   * Lấy nội dung chi tiết từ URL với trích dẫn nguồn
   * @param url - URL cần lấy nội dung
   * @returns Promise<any> - Nội dung trang web với metadata
   */
  async fetchContentWithSource(url: string): Promise<any> {
    try {
      this.logger.log(`Đang lấy nội dung từ: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Trích xuất thông tin cơ bản
      const title = $('title').text().trim() || $('h1').first().text().trim();
      const description = $('meta[name="description"]').attr('content') || 
                         $('meta[property="og:description"]').attr('content') || '';
      
      // Trích xuất nội dung chính
      const mainContent = this.extractMainContent($);
      
      // Trích xuất bảng giá (nếu có)
      const tables = this.extractStructuredTables($);
      
      // Trích xuất thông tin giá cả
      const priceInfo = this.extractPriceInformation($);

      const contentWithSource = {
        url: url,
        title: title,
        description: description,
        content: mainContent,
        tables: tables,
        priceInfo: priceInfo,
        extractedAt: new Date().toISOString(),
        wordCount: mainContent.split(' ').length,
        hasReliableData: tables.length > 0 || priceInfo.prices.length > 0
      };

      this.logger.log(`Đã trích xuất nội dung từ ${url}: ${contentWithSource.wordCount} từ, ${tables.length} bảng`);
      return contentWithSource;
    } catch (error: any) {
      this.logger.error(`Lỗi khi lấy nội dung từ ${url}:`, error);
      throw new Error(`Không thể lấy nội dung từ ${url}: ${error.message}`);
    }
  }

  /**
   * Tổng hợp thông tin từ nhiều nguồn (RAG approach)
   * @param query - Câu hỏi/từ khóa tìm kiếm
   * @returns Promise<any> - Thông tin tổng hợp với trích dẫn nguồn
   */
  async aggregateMultiSourceInfo(query: string): Promise<any> {
    try {
      this.logger.log(`Đang tổng hợp thông tin từ nhiều nguồn cho: "${query}"`);
      
      // Bước 1: Tìm kiếm web thời gian thực
      let webResults: any;
      try {
        webResults = await this.searchWebRealTime(query);
      } catch (error: any) {
        this.logger.warn(`Không thể tìm kiếm web: ${error.message}`);
        throw error; // Ném lại lỗi gốc để tránh lặp thông báo
      }
      
      // Bước 2: Tìm kiếm tin tức
      let newsResults: any;
      try {
        newsResults = await this.searchRiceNewsMultiSource(query);
      } catch (error: any) {
        this.logger.warn(`Không thể tìm kiếm tin tức: ${error.message}`);
        throw error; // Ném lại lỗi gốc để tránh lặp thông báo
      }
      
      // Bước 3: Lấy nội dung chi tiết từ 3 nguồn đáng tin cậy nhất
      const topSources = webResults.sources?.slice(0, 3) || [];
      const detailedContent: any[] = [];
      
      for (const source of topSources) {
        try {
          const content = await this.fetchContentWithSource(source.url);
          detailedContent.push({
            ...content,
            sourceRank: source.position,
            searchSnippet: source.snippet
          });
        } catch (error) {
          this.logger.warn(`Không thể lấy nội dung từ ${source.url}:`, error);
        }
      }
      
      // Bước 4: Tổng hợp kết quả
      const aggregatedInfo = {
        query: query,
        searchTime: new Date().toISOString(),
        sources: {
          web: webResults.sources || [],
          news: newsResults.sources || [],
          detailed: detailedContent
        },
        summary: {
          totalSources: (webResults.sources?.length || 0) + (newsResults.sources?.length || 0),
          reliableSources: detailedContent.filter((c: any) => c.hasReliableData).length,
          totalContent: detailedContent.reduce((sum: number, c: any) => sum + (c.wordCount || 0), 0)
        },
        citations: this.generateCitations(webResults.sources || [], newsResults.sources || [], detailedContent as any[])
      };

      this.logger.log(`Tổng hợp thành công từ ${aggregatedInfo.summary.totalSources} nguồn`);
      return aggregatedInfo;
    } catch (error: any) {
      this.logger.error('Lỗi khi tổng hợp thông tin từ nhiều nguồn:', error);
      throw new Error(`Không thể tổng hợp thông tin: ${error.message}`);
    }
  }

  /**
   * Tạo danh sách trích dẫn nguồn
   * @param webSources - Nguồn từ tìm kiếm web
   * @param newsSources - Nguồn từ tin tức
   * @param detailedSources - Nguồn chi tiết
   * @returns any[] - Danh sách trích dẫn
   */
  private generateCitations(webSources: any[], newsSources: any[], detailedSources: any[]): any[] {
    const citations: any[] = [];
    let citationId = 1;

    // Trích dẫn từ web search
    webSources.forEach(source => {
      citations.push({
        id: citationId++,
        type: 'web',
        title: source.title,
        url: source.url,
        snippet: source.snippet,
        displayUrl: source.displayUrl
      });
    });

    // Trích dẫn từ tin tức
    newsSources.forEach(source => {
      citations.push({
        id: citationId++,
        type: 'news',
        title: source.title,
        url: source.url,
        snippet: source.snippet,
        source: source.source,
        date: source.date
      });
    });

    // Trích dẫn từ nội dung chi tiết
    detailedSources.forEach(source => {
      citations.push({
        id: citationId++,
        type: 'detailed',
        title: source.title,
        url: source.url,
        description: source.description,
        hasData: source.hasReliableData,
        wordCount: source.wordCount
      });
    });

    return citations;
  }

  /**
   * Trích xuất nội dung chính từ trang web
   * @param $ - Cheerio instance
   * @returns string - Nội dung chính
   */
  private extractMainContent($: any): string {
    // Loại bỏ các element không cần thiết
    $('script, style, nav, header, footer, .advertisement, .ads, .sidebar').remove();
    
    // Tìm nội dung chính
    const mainSelectors = [
      '.entry-content',
      '.post-content', 
      '.content',
      'article',
      '.main-content',
      '#content'
    ];
    
    let mainContent = '';
    for (const selector of mainSelectors) {
      const content = $(selector).text().trim();
      if (content && content.length > 100) {
        mainContent = content;
        break;
      }
    }
    
    // Nếu không tìm thấy, lấy body nhưng loại bỏ noise
    if (!mainContent) {
      mainContent = $('body').text().trim();
    }
    
    // Làm sạch content
    mainContent = mainContent
      .replace(/\s+/g, ' ')  // Loại bỏ whitespace thừa
      .replace(/\n{3,}/g, '\n\n')  // Loại bỏ line break thừa
      .trim();
    
    return mainContent.substring(0, 2000); // Giới hạn 2000 ký tự cho main content
  }

  /**
   * Trích xuất các bảng dữ liệu có cấu trúc
   * @param $ - Cheerio instance
   * @returns any[] - Danh sách bảng có cấu trúc
   */
  private extractStructuredTables($: any): any[] {
    const structuredTables: any[] = [];
    
    $('table').each((tableIndex, table) => {
      try {
        const tableData: any = {
          index: tableIndex,
          headers: [],
          rows: [],
          metadata: {}
        };
        
        // Tìm tiêu đề bảng từ caption hoặc heading gần đó
        const caption = $(table).find('caption').text().trim();
        const prevHeading = $(table).prev('h1, h2, h3, h4, h5, h6').text().trim();
        tableData.metadata.title = caption || prevHeading || `Bảng ${tableIndex + 1}`;
        
        // Trích xuất headers từ row đầu tiên
        const firstRow = $(table).find('tr').first();
        firstRow.find('th, td').each((_, cell) => {
          const headerText = $(cell).text().trim().replace(/\s+/g, ' ');
          if (headerText) {
            tableData.headers.push(headerText);
          }
        });
        
        // Trích xuất data rows (bỏ qua row đầu tiên là header)
        const dataRows = $(table).find('tr').slice(1);
        dataRows.each((_, row) => {
          const rowData: any = {};
          const cells = $(row).find('td, th');
          
          cells.each((cellIndex, cell) => {
            const cellText = $(cell).text().trim().replace(/\s+/g, ' ');
            const headerKey = tableData.headers[cellIndex] || `column_${cellIndex}`;
            
            rowData[headerKey] = {
              raw: cellText,
              processed: cellText
            };
          });
          
          if (Object.keys(rowData).length > 0) {
            tableData.rows.push(rowData);
          }
        });
        
        // Thêm bảng nếu có headers và data
        if (tableData.headers.length > 0 && tableData.rows.length > 0) {
          structuredTables.push(tableData);
        }
      } catch (tableError) {
        this.logger.error(`Lỗi khi xử lý bảng ${tableIndex + 1}:`, tableError);
      }
    });
    
    return structuredTables;
  }

  /**
   * Trích xuất thông tin giá cả từ nội dung
   * @param $ - Cheerio instance
   * @returns any - Thông tin giá cả
   */
  private extractPriceInformation($: any): any {
    const priceInfo = {
      prices: [] as string[],
      trends: [] as string[],
      locations: [] as string[]
    };
   
    // Tìm các đoạn text chứa thông tin giá
    $('*').each((_, element) => {
      const text = $(element).text();
      
      // Tìm giá lúa/gạo (pattern: số + đơn vị)
      const priceMatches = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(đồng|VNĐ|vnđ)\/?(kg|kilogram)?/gi);
      if (priceMatches) {
        priceMatches.forEach(match => {
          priceInfo.prices.push(match.trim());
        });
      }
      
      // Tìm xu hướng tăng/giảm
      const trendMatches = text.match(/(tăng|giảm|ổn định|không đổi)\s*(\d+(?:,\d+)*)?/gi);
      if (trendMatches) {
        priceInfo.trends.push(...trendMatches);
      }
      
      // Tìm địa điểm
      const locationMatches = text.match(/(An Giang|Đồng Tháp|Kiên Giang|Cần Thơ|Hậu Giang|Sóc Trăng|Bạc Liêu|Cà Mau)/gi);
      if (locationMatches) {
        priceInfo.locations.push(...locationMatches);
      }
    });
    
    // Loại bỏ duplicate
    priceInfo.prices = [...new Set(priceInfo.prices)];
    priceInfo.trends = [...new Set(priceInfo.trends)];
    priceInfo.locations = [...new Set(priceInfo.locations)];
    
    return priceInfo;
  }

  /**
   * Lấy thông tin về MCP Server
   * @returns Object chứa thông tin server
   */
  getServerInfo() {
    return {
      name: 'gn-argi-mcp-server',
      version: '2.0.0',
      description: 'MCP Server cho hệ thống phân tích thị trường lúa gạo GN-ARGI với tính năng web search thời gian thực',
      capabilities: {
        resources: ['rice-market-data', 'weather-data', 'news-feed', 'web-search-realtime'],
        tools: ['web-search', 'data-analysis', 'market-prediction', 'multi-source-aggregation'],
        prompts: ['market-analysis', 'price-prediction', 'risk-assessment', 'source-citation'],
      },
      status: 'active',
      timestamp: new Date().toISOString(),
    };
  }

  // Các method cũ để tương thích ngược
  async getLatestRicePriceArticle(): Promise<string> {
    // Sử dụng tìm kiếm web mới thay vì crawl cố định
    const searchResults = await this.searchRiceNewsMultiSource("giá lúa gạo hôm nay");
    if (searchResults.sources.length > 0) {
      return searchResults.sources[0].url;
    }
    throw new Error('Không tìm thấy bài viết về giá lúa gạo');
  }

  async getLatestRicePriceData(): Promise<any> {
    // Sử dụng tổng hợp đa nguồn thay vì crawl một trang
    const aggregatedData = await this.aggregateMultiSourceInfo("giá lúa gạo hôm nay");
    
    return {
      url: aggregatedData.sources.detailed[0]?.url || '',
      title: aggregatedData.sources.detailed[0]?.title || 'Giá lúa gạo hôm nay',
      date: new Date().toLocaleDateString('vi-VN'),
      fullContent: aggregatedData.sources.detailed.map(s => s.content).join('\n\n'),
      summary: {
        contentLength: aggregatedData.summary.totalContent,
        extractedAt: aggregatedData.searchTime,
        hasTableData: aggregatedData.sources.detailed.some(s => s.tables.length > 0),
        totalSources: aggregatedData.summary.totalSources,
        citations: aggregatedData.citations
      }
    };
  }

  /**
   * Tìm kiếm video YouTube về giá lúa gạo
   * @param query - Từ khóa tìm kiếm
   * @param limit - Số lượng video tối đa
   * @returns Promise<YouTubeSearchResult> - Kết quả tìm kiếm YouTube
   */
  async getYouTubeVideos(query: string = "giá lúa gạo hôm nay", limit: number = 10): Promise<YouTubeSearchResult> {
    try {
      this.logger.log(`Tìm kiếm YouTube videos với query: "${query}", limit: ${limit}`);
      
      // Tạm thời trả về mock data do SerpAPI chưa được cài đặt
      this.logger.warn('SerpAPI chưa được cài đặt, trả về mock data');
      
      const mockVideos: YouTubeVideoData[] = [
        {
          id: "mock1",
          title: "Giá lúa gạo hôm nay - Cập nhật thị trường",
          url: "https://youtube.com/watch?v=mock1",
          thumbnail: "https://img.youtube.com/vi/mock1/default.jpg",
          channel: {
            name: "Thông tin nông nghiệp",
            url: "https://youtube.com/channel/mock1"
          },
          duration: "5:30",
          views: "10,000",
          uploadTime: "1 ngày trước",
          description: "Cập nhật giá lúa gạo mới nhất",
          isLive: false
        },
        {
          id: "mock2",
          title: "Thị trường lúa gạo tuần này",
          url: "https://youtube.com/watch?v=mock2", 
          thumbnail: "https://img.youtube.com/vi/mock2/default.jpg",
          channel: {
            name: "Kinh tế nông nghiệp",
            url: "https://youtube.com/channel/mock2"
          },
          duration: "7:15",
          views: "8,500",
          uploadTime: "2 ngày trước",
          description: "Phân tích thị trường lúa gạo",
          isLive: false
        }
      ];

      return {
        videos: mockVideos,
        query: query,
        searchTime: new Date().toISOString(),
        totalResults: mockVideos.length,
        searchQuality: {
          hasRecentVideos: true,
          todayVideosCount: 1,
          score: 70
        }
      };

    } catch (error: any) {
      this.logger.error(`Lỗi khi tìm kiếm YouTube videos: ${error.message}`);
      return {
        videos: [],
        query: query,
        searchTime: new Date().toISOString(),
        totalResults: 0,
        searchQuality: {
          hasRecentVideos: false,
          todayVideosCount: 0,
          score: 0
        },
        error: `Lỗi tìm kiếm YouTube: ${error.message}`
      };
    }
  }

}
