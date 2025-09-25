import { Injectable, Logger } from '@nestjs/common';
// Import undici wrapper để fix lỗi File is not defined trong Node.js v18
import { fetch } from './undici-wrapper';
import * as cheerio from 'cheerio';
import { YouTubeSearchResult, YouTubeVideoData } from './interfaces/rice-analysis.interface';

/**
 * MCP (Model Context Protocol) Server Service
 * Cung cấp tích hợp MCP Server cho AI Analysis Service
 * Thay thế WebSearchService với khả năng mở rộng tốt hơn
 */
@Injectable()
export class McpServerService {
  private readonly logger = new Logger(McpServerService.name);

  constructor() {
    this.logger.log('MCP Server Service đã được khởi tạo');
  }

  /**
   * Lấy link bài viết mới nhất về giá lúa gạo từ trang congthuong.vn
   * @returns Promise<string> - Link bài viết mới nhất
   */
  async getLatestRicePriceArticle(): Promise<string> {
    try {
      this.logger.log('Đang lấy link bài viết mới nhất về giá lúa gạo từ congthuong.vn...');
      
      const categoryUrl = 'https://congthuong.vn/chu-de/gia-lua-gao-hom-nay.topic';
      
      // Fetch trang danh sách bài viết
      const response = await fetch(categoryUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();

      // Parse HTML bằng cheerio
      const $ = cheerio.load(html);
      
      // Lấy 5 bài viết đầu tiên từ danh sách
      const articleLinks: { href: string; text: string; date?: Date }[] = [];
      
      // Tìm các link bài viết trong trang (dựa trên cấu trúc HTML của congthuong.vn)
       $('a').each((_, element) => {
         if (articleLinks.length >= 5) return false; // Chỉ lấy 5 bài đầu tiên
         
         const href = $(element).attr('href');
         const text = $(element).text().trim();
         
         // Kiểm tra xem có phải link bài viết về giá lúa gạo không
         if (href && text && text.toLowerCase().includes('giá') && 
             (text.toLowerCase().includes('lúa') || text.toLowerCase().includes('gạo'))) {
           
           // Tạo URL đầy đủ nếu cần
           let fullUrl: string = href;
           if (href.startsWith('/')) {
             fullUrl = `https://congthuong.vn${href}`;
           } else if (!href.startsWith('http')) {
             fullUrl = `https://congthuong.vn/${href}`;
           }
           
           articleLinks.push({
             href: fullUrl,
             text: text
           });
         }
         return undefined;
       });
      
      this.logger.log(`Đã lấy được ${articleLinks.length} bài viết từ 5 bài đầu tiên`);
      
      // Lọc các bài viết có tiêu đề chứa "Giá lúa gạo hôm nay ngày"
      const filteredArticles = articleLinks.filter(article => 
        article.text.toLowerCase().includes('giá lúa gạo hôm nay ngày')
      );
      
      this.logger.log(`Tìm thấy ${filteredArticles.length} bài viết có tiêu đề chứa "Giá lúa gạo hôm nay ngày"`);
      
      if (filteredArticles.length === 0) {
        throw new Error('Không tìm thấy bài viết nào có tiêu đề chứa "Giá lúa gạo hôm nay ngày" trong 5 bài đầu tiên');
      }
      
      // Tìm bài viết mới nhất dựa trên ngày trong tiêu đề
       let latestArticle = filteredArticles[0];
       let latestDate: Date | null = null;
       
       for (const article of filteredArticles) {
          // Trích xuất ngày từ tiêu đề (pattern: "ngày DD/MM" hoặc "ngày DD/MM/YYYY")
          const dateMatch = article.text.match(/ngày\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/i);
          if (dateMatch && dateMatch[1] && dateMatch[2]) {
            const day = parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]);
            const year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
            
            const articleDate = new Date(year, month - 1, day);
            
            if (!latestDate || articleDate > latestDate) {
              latestDate = articleDate;
              latestArticle = article;
            }
          }
        }
       
       if (!latestArticle) {
         throw new Error('Không thể xác định bài viết mới nhất');
       }
       
       this.logger.log(`Bài viết mới nhất được chọn: ${latestArticle.text}`);
       this.logger.log(`Link chi tiết: ${latestArticle.href}`);
       
       return latestArticle.href;

    } catch (error: any) {
      this.logger.error('Lỗi khi lấy link bài viết mới nhất từ congthuong.vn:', error.message);
      throw new Error(`Không thể lấy link bài viết mới nhất: ${error.message}`);
    }
  }

  /**
   * Lấy toàn bộ nội dung trang web về giá lúa từ congthuong.vn
   * Trả về raw content cho AI phân tích thay vì parse bằng regex
   * @returns Promise<any> Toàn bộ nội dung trang web để AI phân tích
   */
  async getLatestRicePriceData(): Promise<any> {
    try {
      this.logger.log('Đang lấy toàn bộ nội dung trang web về giá lúa từ congthuong.vn...');
      
      // Lấy link bài viết mới nhất
      const articleUrl = await this.getLatestRicePriceArticle();
      
      // Fetch nội dung bài viết chi tiết
      const response = await fetch(articleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();

      // Parse HTML để lấy nội dung chính
      const $ = cheerio.load(html);
      
      // Lấy tiêu đề bài viết
      const title = $('h1, .title, .post-title, .entry-title, .article-title').first().text().trim();
      
      // Lấy toàn bộ nội dung bài viết với nhiều selector khác nhau
      let articleContent = '';
      
      // Thử các selector phổ biến cho nội dung bài viết
      const contentSelectors = [
        '.article-detail-body',
        '.article-detail-desc', 
        '.article-content',
        '.post-content',
        '.entry-content',
        '.content',
        '.detail-content',
        'article',
        '.main-content'
      ];
      
      for (const selector of contentSelectors) {
        const content = $(selector).text().trim();
        if (content && content.length > articleContent.length) {
          articleContent = content;
        }
      }
      
      // Nếu vẫn không có nội dung, lấy toàn bộ text từ body
      if (!articleContent || articleContent.length < 100) {
        articleContent = $('body').text().trim();
      }
      
      // Lấy nội dung từ các bảng (nếu có)
      let tableContent = '';
      $('table').each((_, table) => {
        const $table = $(table);
        const tableText = $table.text().trim();
        if (tableText.includes('lúa') || tableText.includes('giá')) {
          tableContent += '\n--- BẢNG DỮ LIỆU ---\n' + tableText + '\n';
        }
      });
      
      // Trích xuất ngày từ title hoặc content
      const dateMatch = title.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      const articleDate = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('vi-VN');

      // Kết hợp toàn bộ nội dung
      const fullContent = `${title}\n\nNgày: ${articleDate}\n\n${articleContent}\n${tableContent}`;

      const result = {
        url: articleUrl,
        title: title,
        date: articleDate,
        fullContent: fullContent, // Toàn bộ nội dung cho AI phân tích
        summary: {
          contentLength: fullContent.length,
          extractedAt: new Date().toISOString(),
          hasTableData: tableContent.length > 0
        }
      };

      this.logger.log(`Đã lấy thành công toàn bộ nội dung trang web (${fullContent.length} ký tự) cho AI phân tích`);
      return result;

    } catch (error: any) {
      this.logger.error('Lỗi khi lấy nội dung trang web từ congthuong.vn:', error.message);
      throw new Error(`Không thể lấy nội dung trang web: ${error.message}`);
    }
  }



  /**
   * Lấy thông tin về MCP Server
   * @returns Object chứa thông tin server
   */
  getServerInfo() {
    return {
      name: 'gn-argi-mcp-server',
      version: '1.0.0',
      description:
        'MCP Server cho hệ thống phân tích thị trường lúa gạo GN-ARGI',
      capabilities: {
        resources: ['rice-market-data', 'weather-data', 'news-feed'],
        tools: ['web-search', 'data-analysis', 'market-prediction'],
        prompts: ['market-analysis', 'price-prediction', 'risk-assessment'],
      },
      status: 'active',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Tìm kiếm thông tin thị trường lúa gạo
   * @param query - Từ khóa tìm kiếm
   * @returns Promise<any> - Kết quả tìm kiếm
   */
  async searchRiceMarketInfo(query: string): Promise<any> {
    try {
      this.logger.log(`Tìm kiếm thông tin thị trường: ${query}`);

      // Sử dụng dữ liệu thực từ bài viết mới nhất
      const latestData = await this.getLatestRicePriceData();
      
      return {
        query,
        results: [
          {
            title: latestData.title,
            url: latestData.url,
            date: latestData.date,
            ricePrices: latestData.ricePrices,
            ricePricesRetail: latestData.ricePricesRetail,
            source: 'congthuong.vn',
            timestamp: latestData.summary.extractedAt,
          }
        ],
        metadata: {
          searchTime: new Date().toISOString(),
          resultCount: 1,
          source: 'Real data from congthuong.vn',
        },
      };
    } catch (error) {
      this.logger.error('Lỗi khi tìm kiếm thông tin thị trường:', error);
      throw error;
    }
  }

  /**
   * Lấy tin tức mới nhất về lúa gạo
   * @returns Promise<any> - Danh sách tin tức
   */
  async getLatestRiceNews(): Promise<any> {
    try {
      this.logger.log('Lấy tin tức mới nhất về lúa gạo');

      // Sử dụng dữ liệu thực từ bài viết mới nhất
      const latestData = await this.getLatestRicePriceData();
      
      return {
        news: [
          {
            title: latestData.title,
            summary: `Cập nhật giá lúa gạo ngày ${latestData.date} với ${latestData.summary.totalRiceTypes} loại lúa và ${latestData.summary.totalRetailTypes} loại gạo`,
            publishedAt: latestData.summary.extractedAt,
            source: 'congthuong.vn',
            category: 'giá cả',
            url: latestData.url,
            data: {
              ricePrices: latestData.ricePrices,
              ricePricesRetail: latestData.ricePricesRetail
            }
          }
        ],
        metadata: {
          fetchTime: new Date().toISOString(),
          newsCount: 1,
          source: 'Real data from congthuong.vn',
        },
      };
    } catch (error) {
      this.logger.error('Lỗi khi lấy tin tức:', error);
      throw error;
    }
  }

  /**
   * Tìm kiếm web tổng quát
   * @param query - Từ khóa tìm kiếm
   * @param count - Số lượng kết quả (mặc định 10)
   * @returns Promise<any> - Kết quả tìm kiếm
   */
  async searchWeb(query: string, count: number = 10): Promise<any> {
    try {
      this.logger.log(`Tìm kiếm web: ${query}, số lượng: ${count}`);

      // Tìm kiếm thông tin thực tế từ gaophuongnam.vn
      const searchUrl = `https://gaophuongnam.vn/?s=${encodeURIComponent(query)}`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const results: any[] = [];

      // Trích xuất kết quả tìm kiếm
       $('.search-results article, .post, .entry').each((index, element) => {
         if (index >= count) return false;
         
         const title = $(element).find('h2 a, h3 a, .entry-title a').first().text().trim();
         const url = $(element).find('h2 a, h3 a, .entry-title a').first().attr('href');
         const snippet = $(element).find('.excerpt, .entry-summary, .entry-content').first().text().trim().substring(0, 200);
         
         if (title && url) {
           results.push({
             title,
             url: url.startsWith('http') ? url : `https://gaophuongnam.vn${url}`,
             snippet: snippet || `Kết quả tìm kiếm cho "${query}"`,
             publishedAt: new Date().toISOString(),
           });
         }
         return undefined; // Đảm bảo tất cả code paths đều return value
       });

      return {
        query,
        count: results.length,
        results,
        metadata: {
          searchTime: new Date().toISOString(),
          totalResults: results.length,
          source: 'Real search from gaophuongnam.vn',
        },
      };
    } catch (error) {
      this.logger.error('Lỗi khi tìm kiếm web:', error);
      throw error;
    }
  }

  /**
   * Lấy nội dung từ URL
   * @param url - URL cần lấy nội dung
   * @returns Promise<any> - Nội dung từ URL
   */
  async fetchUrlContent(url: string): Promise<any> {
    try {
      this.logger.log(`🔍 Bắt đầu lấy nội dung từ URL: ${url}`);

      // Thêm delay ngẫu nhiên để tránh bị phát hiện là bot
      const delay = Math.floor(Math.random() * 2000) + 1000; // 1-3 giây
      this.logger.log(`⏳ Đợi ${delay}ms để tránh bị phát hiện bot...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Lấy nội dung thực tế từ URL với headers đầy đủ để bypass anti-bot protection
      this.logger.log(`📡 Gửi request đến ${url} với headers đầy đủ...`);
      const response = await fetch(url, {
        headers: {
          // User-Agent mới nhất Chrome 131 (tháng 12/2024)
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0',
          // Thêm các headers Chrome thực tế
          'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'DNT': '1',
          // Referer để giả lập người dùng thực
          'Referer': 'https://www.google.com/'
        },
        // Thêm timeout để tránh hang
        signal: AbortSignal.timeout(30000) // 30 giây timeout
      });

      this.logger.log(`📊 Response status: ${response.status}`);
      this.logger.log(`📋 Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);

      if (!response.ok) {
        this.logger.error(`❌ HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      this.logger.log(`📄 HTML content length: ${html.length} characters`);
      
      // Log một phần HTML để kiểm tra
      const htmlPreview = html.substring(0, 500);
      this.logger.log(`📝 HTML preview (first 500 chars): ${htmlPreview}`);
      
      const $ = cheerio.load(html);
      
      // Trích xuất tiêu đề bài viết
      const title = $('h1, .entry-title, .post-title').first().text().trim();
      this.logger.log(`📰 Tiêu đề bài viết: "${title}"`);
      
      // Trích xuất ngày từ tiêu đề hoặc meta data
      const dateMatch = title.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{1,2})/);
      const extractedDate = dateMatch ? dateMatch[0] : null;
      this.logger.log(`📅 Ngày trích xuất: ${extractedDate || 'Không tìm thấy'}`);
      
      // Trích xuất các bảng giá một cách structured và chi tiết
      this.logger.log('🔍 Bắt đầu trích xuất bảng giá structured...');
      const structuredTables = this.extractStructuredTables($);
      this.logger.log(`📊 Số bảng giá tìm thấy: ${structuredTables.length}`);
      structuredTables.forEach((table, index) => {
        this.logger.log(`📋 Bảng ${index + 1}: ${table.rows?.length || 0} dòng dữ liệu`);
      });
      
      this.logger.log('🔍 Hoàn thành trích xuất bảng giá structured');
      
      // Debug log để kiểm tra structured tables
      this.logger.log(`Found ${structuredTables.length} structured tables`);
      if (structuredTables.length > 0) {
        structuredTables.forEach((table, index) => {
          this.logger.log(`Table ${index + 1}: ${table.metadata?.title}`);
          this.logger.log(`Headers: ${JSON.stringify(table.headers)}`);
          this.logger.log(`Rows count: ${table.rows?.length || 0}`);
        });
      } else {
        this.logger.log('No structured tables found, checking raw table elements...');
        const tableCount = $('table').length;
        this.logger.log(`Raw table elements found: ${tableCount}`);
        if (tableCount > 0) {
          $('table').each((index, table) => {
            const rowCount = $(table).find('tr').length;
            this.logger.log(`Raw table ${index + 1}: ${rowCount} rows`);
          });
        }
      }
      
      // Trích xuất thông tin giá cụ thể từ text
      const priceData = this.extractPriceInformation($);
      
      // Trích xuất nội dung chính (chỉ lấy phần quan trọng)
      const mainContent = this.extractMainContent($);
      
      // Tạo summary content cho AI với thông tin quan trọng nhất
       const summaryContent = this.createSummaryContent(title, extractedDate || '', structuredTables, priceData, mainContent);

      this.logger.log(`Extracted title: ${title}`);
      this.logger.log(`Extracted date: ${extractedDate}`);
      this.logger.log(`Found ${structuredTables.length} structured tables`);
      this.logger.log(`Summary content length: ${summaryContent.length}`);

      return {
        url,
        title,
        date: extractedDate,
        content: summaryContent,
        structuredTables,
        priceData,
        rawTablesCount: structuredTables.length,
        timestamp: new Date().toISOString(),
        status: 'success',
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi lấy nội dung từ URL ${url}:`, error);
      return {
        url,
        content: null,
        error: error.message,
        timestamp: new Date().toISOString(),
        status: 'error',
      };
    }
  }

  /**
   * Trích xuất các bảng dữ liệu một cách structured
   */
  private extractStructuredTables($: any): any[] {
    try {
      this.logger.log('=== EXTRACT STRUCTURED TABLES START ===');
      const structuredTables: any[] = [];
      
      // Kiểm tra số lượng bảng trước
      const tableCount = $('table').length;
      this.logger.log(`Found ${tableCount} table elements in HTML`);
      
      if (tableCount === 0) {
        this.logger.log('No table elements found, returning empty array');
        return structuredTables;
      }
      
      $('table').each((tableIndex, table) => {
        try {
          this.logger.log(`Processing table ${tableIndex + 1}...`);
          
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
          this.logger.log(`Table ${tableIndex + 1} title: "${tableData.metadata.title}"`);
          
          // Trích xuất headers từ row đầu tiên
          const firstRow = $(table).find('tr').first();
          this.logger.log(`Table ${tableIndex + 1} first row found: ${firstRow.length > 0}`);
          
          firstRow.find('th, td').each((_, cell) => {
            const headerText = $(cell).text().trim().replace(/\s+/g, ' ');
            if (headerText) {
              tableData.headers.push(headerText);
            }
          });
          
          this.logger.log(`Table ${tableIndex + 1} headers: ${JSON.stringify(tableData.headers)}`);
          
          // Trích xuất data rows (bỏ qua row đầu tiên là header)
          const dataRows = $(table).find('tr').slice(1);
          this.logger.log(`Table ${tableIndex + 1} data rows count: ${dataRows.length}`);
          
          dataRows.each((rowIndex, row) => {
            try {
              const rowData: any = {};
              const cells = $(row).find('td, th');
              
              cells.each((cellIndex, cell) => {
                const cellText = $(cell).text().trim().replace(/\s+/g, ' ');
                const headerKey = tableData.headers[cellIndex] || `column_${cellIndex}`;
                
                // Xử lý dữ liệu số và giá
                let processedValue = cellText;
                if (cellText.match(/[\d,.\-]+/)) {
                  // Giữ nguyên format giá có dấu gạch ngang
                  processedValue = cellText;
                }
                
                rowData[headerKey] = {
                  raw: cellText,
                  processed: processedValue
                };
              });
              
              if (Object.keys(rowData).length > 0) {
                tableData.rows.push(rowData);
              }
            } catch (rowError) {
              this.logger.error(`Error processing row ${rowIndex} in table ${tableIndex + 1}:`, rowError);
            }
          });
          
          this.logger.log(`Table ${tableIndex + 1}: ${tableData.rows.length} data rows processed`);
          
          // Thêm bảng nếu có headers và data
          if (tableData.headers.length > 0 && tableData.rows.length > 0) {
            structuredTables.push(tableData);
            this.logger.log(`Added table ${tableIndex + 1} to structured tables`);
          } else {
            this.logger.log(`Skipped table ${tableIndex + 1} - headers: ${tableData.headers.length}, rows: ${tableData.rows.length}`);
          }
        } catch (tableError) {
          this.logger.error(`Error processing table ${tableIndex + 1}:`, tableError);
        }
      });
      
      this.logger.log(`=== EXTRACT STRUCTURED TABLES END - Total: ${structuredTables.length} ===`);
      return structuredTables;
    } catch (error) {
      this.logger.error('Error in extractStructuredTables:', error);
      return [];
    }
  }

  /**
   * Trích xuất thông tin giá cụ thể từ text
   */
  private extractPriceInformation($: any): any {
     const priceInfo = {
       ricePrices: [] as string[],
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
          priceInfo.ricePrices.push(match.trim());
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
    priceInfo.ricePrices = [...new Set(priceInfo.ricePrices)];
    priceInfo.trends = [...new Set(priceInfo.trends)];
    priceInfo.locations = [...new Set(priceInfo.locations)];
    
    return priceInfo;
  }

  /**
   * Trích xuất nội dung chính quan trọng
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
    
    return mainContent.substring(0, 1000); // Giới hạn 1000 ký tự cho main content
  }

  /**
   * Tạo summary content cho AI với thông tin quan trọng nhất
   */
  private createSummaryContent(title: string, date: string, tables: any[], priceData: any, mainContent: string): string {
    let summary = '';
    
    // Thêm tiêu đề và ngày
    summary += `TIÊU ĐỀ: ${title}\n`;
    if (date) {
      summary += `NGÀY: ${date}\n`;
    }
    summary += '\n';
    
    // Thêm thông tin bảng structured
    if (tables.length > 0) {
      summary += `BẢNG GIÁ STRUCTURED (${tables.length} bảng):\n`;
      tables.forEach((table, index) => {
        summary += `\nBảng ${index + 1}: ${table.metadata.title}\n`;
        summary += `Headers: ${table.headers.join(', ')}\n`;
        summary += `Số dòng dữ liệu: ${table.rows.length}\n`;
        
        // Thêm một vài dòng dữ liệu mẫu
        if (table.rows.length > 0) {
          summary += 'Dữ liệu mẫu:\n';
          table.rows.slice(0, 3).forEach((row) => {
            const rowSummary = Object.entries(row).map(([key, value]: [string, any]) => 
              `${key}: ${value.processed || value.raw}`
            ).join(', ');
            summary += `  - ${rowSummary}\n`;
          });
        }
      });
      summary += '\n';
    }
    
    // Thêm thông tin giá trích xuất
    if (priceData.ricePrices.length > 0) {
      summary += `GIÁ TRÍCH XUẤT: ${priceData.ricePrices.join(', ')}\n`;
    }
    if (priceData.trends.length > 0) {
      summary += `XU HƯỚNG: ${priceData.trends.join(', ')}\n`;
    }
    if (priceData.locations.length > 0) {
      summary += `ĐỊA ĐIỂM: ${priceData.locations.join(', ')}\n`;
    }
    
    // Thêm một phần nội dung chính
    if (mainContent) {
      summary += `\nNỘI DUNG CHÍNH:\n${mainContent.substring(0, 500)}...\n`;
    }
    
    return summary;
  }

  /**
   * Phân tích dữ liệu thị trường
   * @param data - Dữ liệu cần phân tích
   * @returns Promise<any> - Kết quả phân tích
   */
  async analyzeMarketData(data: any): Promise<any> {
    try {
      this.logger.log('Phân tích dữ liệu thị trường');

      // Phân tích dữ liệu thực tế từ bài viết mới nhất
      const latestData = await this.getLatestRicePriceData();
      
      // Tính toán xu hướng giá dựa trên dữ liệu thực
      const ricePrices = latestData.ricePrices || [];
      const retailPrices = latestData.ricePricesRetail || [];
      
      // Phân tích xu hướng từ text trong bài viết
      const content = latestData.rawContent?.toLowerCase() || '';
      let trend = 'ổn định';
      let confidence = 0.7;
      
      if (content.includes('tăng') || content.includes('lên')) {
        trend = 'tăng';
        confidence = 0.8;
      } else if (content.includes('giảm') || content.includes('xuống')) {
        trend = 'giảm';
        confidence = 0.8;
      }

      const analysis = {
        input: data,
        latestData: latestData,
        analysis: {
          trend: trend,
          confidence: confidence,
          factors: [
            'Dữ liệu thực tế từ gaophuongnam.vn',
            `Có ${ricePrices.length} loại lúa được cập nhật`,
            `Có ${retailPrices.length} loại gạo bán lẻ`,
            'Thông tin cập nhật từ thị trường Đồng bằng sông Cửu Long'
          ],
          prediction: {
            shortTerm: `Dựa trên dữ liệu ngày ${latestData.date}, xu hướng ${trend} có thể tiếp tục trong 1-2 tuần tới`,
            longTerm: 'Cần theo dõi thêm dữ liệu để đưa ra dự báo dài hạn chính xác',
          },
          priceRanges: {
            ricePrices: ricePrices.map(item => ({
              type: item.type,
              price: item.price,
              change: item.change
            })),
            retailPrices: retailPrices.map(item => ({
              type: item.type,
              price: item.price,
              change: item.change
            }))
          }
        },
        metadata: {
          analysisTime: new Date().toISOString(),
          model: 'Real Data Analysis v1.0',
          source: 'congthuong.vn',
          dataDate: latestData.date
        },
      };

      return analysis;
    } catch (error) {
      this.logger.error('Lỗi khi phân tích dữ liệu:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách video YouTube về giá lúa gạo hôm nay
   * Sử dụng youtube-search-api để tìm kiếm video mà không cần API key
   * @param query - Từ khóa tìm kiếm (mặc định: "giá lúa gạo hôm nay")
   * @param limit - Số lượng video tối đa (mặc định: 10)
   * @returns Promise<YouTubeSearchResult> - Danh sách video YouTube với thumbnail
   */
  async getYouTubeVideos(query: string = 'giá lúa gạo hôm nay', limit: number = 10): Promise<YouTubeSearchResult> {
    try {
      this.logger.log(`Bắt đầu tìm kiếm YouTube videos với từ khóa: "${query}"`);
      
      // Import youtube-search-api dynamically
      const youtubeSearch = await import('youtube-search-api');
      
      // Tìm kiếm video trên YouTube
      const searchResults = await youtubeSearch.GetListByKeyword(query, false, limit);
      
      if (!searchResults || !searchResults.items || searchResults.items.length === 0) {
        this.logger.warn(`Không tìm thấy video nào với từ khóa: "${query}"`);
        return {
          videos: [],
          query,
          searchTime: new Date().toISOString(),
          totalResults: 0,
          searchQuality: {
            hasRecentVideos: false,
            todayVideosCount: 0,
            score: 0
          }
        };
      }

      // Chuyển đổi kết quả sang định dạng YouTubeVideoData
       const videos: YouTubeVideoData[] = searchResults.items.map((item: any) => {
         // Tạo URL video từ ID
         const videoUrl = `https://www.youtube.com/watch?v=${item.id}`;
         
         // Lấy thumbnail chất lượng cao nhất có sẵn
         let thumbnailUrl = '';
         if (item.thumbnail && item.thumbnail.thumbnails && item.thumbnail.thumbnails.length > 0) {
           // Sắp xếp theo width để lấy thumbnail chất lượng cao nhất
           const sortedThumbnails = item.thumbnail.thumbnails.sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
           thumbnailUrl = sortedThumbnails[0].url;
         }

         const videoData: YouTubeVideoData = {
            id: item.id || '',
            title: item.title || 'Không có tiêu đề',
            url: videoUrl,
            thumbnail: thumbnailUrl,
            channel: {
              name: item.channelTitle || 'Không rõ kênh',
              ...(item.channelId && { url: `https://www.youtube.com/channel/${item.channelId}` })
            },
            duration: item.length?.simpleText || undefined,
            views: item.viewCount?.simpleText || undefined,
            uploadTime: item.publishedTimeText?.simpleText || undefined,
            description: item.descriptionSnippet?.simpleText || undefined,
            isLive: item.isLive || false
          };

         return videoData;
       });

      // Tính toán chất lượng kết quả tìm kiếm
      const todayKeywords = ['hôm nay', 'ngày', new Date().getDate().toString()];
      const todayVideosCount = videos.filter(video => 
        todayKeywords.some(keyword => video.title.toLowerCase().includes(keyword))
      ).length;

      const recentKeywords = ['mới nhất', 'cập nhật', 'live', 'trực tiếp'];
      const hasRecentVideos = videos.some(video => 
        recentKeywords.some(keyword => video.title.toLowerCase().includes(keyword)) ||
        video.isLive ||
        (video.uploadTime && (video.uploadTime.includes('giờ') || video.uploadTime.includes('phút')))
      );

      // Tính điểm chất lượng (0-100)
      let qualityScore = 50; // Điểm cơ bản
      qualityScore += todayVideosCount * 10; // +10 điểm cho mỗi video có từ "hôm nay"
      qualityScore += hasRecentVideos ? 20 : 0; // +20 điểm nếu có video gần đây
      qualityScore += videos.length >= 5 ? 10 : 0; // +10 điểm nếu có đủ 5+ video
      qualityScore = Math.min(qualityScore, 100); // Giới hạn tối đa 100 điểm

      const result: YouTubeSearchResult = {
        videos,
        query,
        searchTime: new Date().toISOString(),
        totalResults: videos.length,
        searchQuality: {
          hasRecentVideos,
          todayVideosCount,
          score: qualityScore
        }
      };

      this.logger.log(`Tìm thấy ${videos.length} video YouTube. Điểm chất lượng: ${qualityScore}/100`);
      this.logger.log(`Video có từ "hôm nay": ${todayVideosCount}, Video gần đây: ${hasRecentVideos}`);

      return result;

    } catch (error: any) {
      this.logger.error('Lỗi khi tìm kiếm YouTube videos:', error.message);
      throw new Error(`Không thể tìm kiếm YouTube videos: ${error.message}`);
    }
  }
}
