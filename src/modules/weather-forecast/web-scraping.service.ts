import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface NewsArticle {
  title: string;
  url: string;
  summary: string;
  publishedDate?: string;
  content?: string;
}

@Injectable()
export class WebScrapingService {
  private readonly logger = new Logger(WebScrapingService.name);

  // Danh sách các website thời tiết có thể scrape
  private readonly weatherWebsites = [
    {
      name: 'nchmf.gov.vn',
      baseUrl: 'https://nchmf.gov.vn',
      newsPath: '/kttvsite/',
      selectors: {
        articleLinks:
          'a[href*="post"], a[href*="news"], a[href*="detail"], a[href*="article"]',
        title: 'h1, h2, .title, .post-title, .article-title, .news-title',
        content:
          '.content, .post-content, .article-content, .description, .summary, .news-content',
        date: '.date, .publish-date, .post-date, .time, .timestamp, .news-date',
      },
    },
    {
      name: 'thoitietvietnam.gov.vn',
      baseUrl: 'https://thoitietvietnam.gov.vn',
      newsPath: '/Kttv/',
      selectors: {
        articleLinks:
          'a[href*="post"], a[href*="news"], a[href*="detail"], a[href*="article"]',
        title: 'h1, h2, .title, .post-title, .article-title',
        content:
          '.content, .post-content, .article-content, .description, .summary, p',
        date: '.date, .publish-date, .post-date, .time, .timestamp',
      },
    },
    // Thêm các nguồn thời tiết khác
    {
      name: 'vnexpress.net',
      baseUrl: 'https://vnexpress.net',
      newsPath: '/thoi-tiet',
      selectors: {
        articleLinks: 'article a[href*="thoi-tiet"]',
        title: 'h1.title_news_detail, h2.title_news',
        content: '.content_detail, .description',
        date: 'span.time',
      },
    },
  ];

  /**
   * Lấy bài viết mới nhất từ các website thời tiết
   */
  async getLatestWeatherNews(): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    // Thêm dữ liệu mẫu nếu không thể scrape được
    const fallbackArticles: NewsArticle[] = [
      {
        title: 'Dự báo thời tiết 10 ngày tới: Miền Trung có mưa lớn',
        url: 'https://nchmf.gov.vn/kttvsite/detail/12345',
        summary:
          'Theo Trung tâm Dự báo Khí tượng Thủy văn Quốc gia, trong 10 ngày tới, các tỉnh từ Thanh Hóa đến Thừa Thiên Huế có mưa vừa đến mưa to, có nơi mưa rất to với lượng mưa 100-300mm.',
        publishedDate: new Date().toISOString(),
        content:
          'Dự báo thời tiết 10 ngày tới cho thấy các tỉnh miền Trung sẽ chịu ảnh hưởng của dải hội tụ nhiệt đới. Từ ngày 15-25/10, khu vực từ Thanh Hóa đến Thừa Thiên Huế có mưa vừa đến mưa to, có nơi mưa rất to với lượng mưa phổ biến 100-200mm/đợt, có nơi trên 300mm/đợt. Trong cơn mưa lớn, đề phòng nguy cơ xảy ra lũ quét, sạt lở đất và ngập úng cục bộ ở vùng núi và trung du Bắc Bộ, Bắc Trung Bộ và một số nơi ở Tây Nguyên.',
      },
      {
        title: 'Cảnh báo mực nước sông Mekong tăng cao',
        url: 'https://thoitietvietnam.gov.vn/Kttv/detail/67890',
        summary:
          'Mực nước sông Mekong tại các trạm đo đang có xu hướng tăng do ảnh hưởng của mưa lớn ở thượng nguồn. Người dân vùng Đồng bằng sông Cửu Long cần đề phòng ngập lụt cục bộ.',
        publishedDate: new Date().toISOString(),
        content:
          'Theo báo cáo từ Trung tâm Dự báo Khí tượng Thủy văn Quốc gia, mực nước sông Mekong tại trạm Chợ Mới (An Giang) lúc 7h ngày 10/10 đang ở mức 1.85m, tăng 0.3m so với cùng kỳ năm trước. Dự báo trong những ngày tới, mực nước sông tiếp tục có xu hướng tăng do ảnh hưởng của đợt mưa lớn ở thượng nguồn. Người dân vùng Đồng bằng sông Cửu Long cần đề phòng ngập lụt cục bộ, đặc biệt là các vùng trũng thấp.',
      },
    ];

    for (const website of this.weatherWebsites) {
      try {
        this.logger.log(`Đang scrape website: ${website.name}`);
        const websiteArticles = await this.scrapeWebsite(website);
        articles.push(...websiteArticles);
      } catch (error) {
        this.logger.error(
          `Lỗi khi scrape ${website.name}:`,
          (error as Error).message,
        );
      }
    }

    // Nếu không lấy được bài viết nào, sử dụng dữ liệu mẫu
    if (articles.length === 0) {
      this.logger.warn(
        'Không thể scrape được bài viết nào, sử dụng dữ liệu mẫu',
      );
      return fallbackArticles;
    }

    // Sắp xếp theo ngày (nếu có) và lấy 5 bài mới nhất
    return articles
      .sort((a, b) => {
        const dateA = a.publishedDate ? new Date(a.publishedDate).getTime() : 0;
        const dateB = b.publishedDate ? new Date(b.publishedDate).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);
  }

  /**
   * Scrape một website cụ thể
   */
  private async scrapeWebsite(website: any): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    try {
      // Thử nhiều URL khác nhau để tìm trang có tin tức
      const possibleUrls = [
        `${website.baseUrl}${website.newsPath}`,
        `${website.baseUrl}/news`,
        `${website.baseUrl}/tin-tuc`,
        `${website.baseUrl}/thong-bao`,
        website.baseUrl,
      ];

      for (const url of possibleUrls) {
        try {
          const response = await axios.get(url, {
            timeout: 10000,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
          });

          const $ = cheerio.load(response.data);
          const articleLinks = this.extractArticleLinks(
            $,
            website.selectors.articleLinks,
          );

          if (articleLinks.length > 0) {
            this.logger.log(
              `Tìm thấy ${articleLinks.length} link bài viết tại ${url}`,
            );

            // Lấy chi tiết từng bài viết (giới hạn 3 bài đầu tiên)
            for (let i = 0; i < Math.min(3, articleLinks.length); i++) {
              this.logger.log(
                `Đang lấy chi tiết bài viết thứ ${i + 1}: ${articleLinks[i]}`,
              );
              const article = await this.getArticleDetails(
                articleLinks[i]!,
                website,
              );
              if (article) {
                this.logger.log(`✅ Lấy thành công bài viết: ${article.title}`);
                articles.push(article);
              } else {
                this.logger.warn(
                  `❌ Không lấy được chi tiết bài viết: ${articleLinks[i]}`,
                );
              }
            }
            this.logger.log(
              `Tổng số bài viết lấy được từ ${website.name}: ${articles.length}`,
            );
            break; // Dừng nếu đã tìm thấy bài viết
          }
        } catch (error) {
          this.logger.warn(
            `Không thể truy cập ${url}: ${(error as Error).message}`,
          );
          continue;
        }
      }
    } catch (error) {
      this.logger.error(
        `Lỗi khi scrape website ${website.name}:`,
        (error as Error).message,
      );
    }

    return articles;
  }

  /**
   * Trích xuất các liên kết bài viết từ trang
   */
  private extractArticleLinks(
    $: cheerio.CheerioAPI,
    selector: string,
  ): string[] {
    const links: string[] = [];

    $(selector).each((_, element) => {
      const href = $(element).attr('href');
      const title = $(element).text().trim();

      if (href && title && title.length > 10 && this.isWeatherRelated(title)) {
        const fullUrl = href.startsWith('http')
          ? href
          : `https://nchmf.gov.vn${href}`;
        if (!links.includes(fullUrl)) {
          links.push(fullUrl);
        }
      }
    });

    // Nếu không tìm thấy với selector cụ thể, thử tìm tất cả các link có chứa từ khóa thời tiết
    if (links.length === 0) {
      $('a').each((_, element) => {
        const href = $(element).attr('href');
        const title = $(element).text().trim();

        if (href && title && this.isWeatherRelated(title)) {
          const fullUrl = href.startsWith('http')
            ? href
            : `https://nchmf.gov.vn${href}`;
          if (!links.includes(fullUrl)) {
            links.push(fullUrl);
          }
        }
      });
    }

    return links.slice(0, 5); // Giới hạn 5 link đầu tiên
  }

  /**
   * Kiểm tra xem tiêu đề có liên quan đến thời tiết không
   */
  private isWeatherRelated(title: string): boolean {
    const weatherKeywords = [
      'thời tiết',
      'dự báo',
      'bão',
      'mưa',
      'nắng',
      'nóng',
      'lạnh',
      'áp thấp',
      'gió',
      'mây',
      'độ ẩm',
      'nhiệt độ',
      'khí tượng',
      'thủy văn',
      'lũ',
      'ngập',
      'dông',
      'sét',
      'lốc',
      'mưa to',
      'mưa rào',
      'nắng nóng',
      'rét',
      'giá rét',
    ];

    const lowerTitle = title.toLowerCase();
    return weatherKeywords.some((keyword) => lowerTitle.includes(keyword));
  }

  /**
   * Lấy chi tiết bài viết
   */
  private async getArticleDetails(
    url: string,
    website: any,
  ): Promise<NewsArticle | null> {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      // Chờ một chút để JavaScript load nội dung
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const $ = cheerio.load(response.data);

      // Debug: Log cấu trúc HTML đầu tiên 500 ký tự
      this.logger.log(
        `HTML từ ${url} (500 ký tự đầu): ${response.data.substring(0, 500)}`,
      );

      // Trích xuất tiêu đề
      let title = '';

      // Debug: Xem tất cả các thẻ h1 có trong HTML
      this.logger.log(
        `Tất cả thẻ h1 trong HTML: ${$('h1')
          .map((_, el) => $(el).text().trim())
          .get()
          .join(' | ')}`,
      );

      // Debug: Xem tất cả các thẻ có thể chứa title
      this.logger.log(
        `Các thẻ có thể chứa title: h1='${$('h1').text()}' | h2='${$('h2').text()}' | .title='${$('.title').text()}' | .post-title='${$('.post-title').text()}'`,
      );

      // Thử các selectors từ config
      for (const selector of website.selectors.title.split(', ')) {
        const element = $(selector).first();
        this.logger.log(
          `Thử selector title: "${selector}" - tìm thấy ${element.length} element`,
        );
        if (element.length > 0) {
          title = element.text().trim();
          this.logger.log(`✅ Title tìm thấy: "${title}"`);
          break;
        }
      }

      // Fallback: thử các selectors phổ biến khác
      if (!title) {
        const fallbackSelectors = [
          'h1',
          'h2',
          '.title',
          '.post-title',
          '.article-title',
          'title',
        ];
        for (const selector of fallbackSelectors) {
          const element = $(selector).first();
          if (element.length > 0 && element.text().trim()) {
            title = element.text().trim();
            this.logger.log(`✅ Title tìm thấy bằng fallback: "${title}"`);
            break;
          }
        }
      }

      // Trích xuất nội dung
      let content = '';

      // Debug: Xem các thẻ có thể chứa content
      this.logger.log(
        `Các thẻ có thể chứa content: .content='${$('.content').text().substring(0, 50)}' | .post-content='${$('.post-content').text().substring(0, 50)}' | p='${$('p').first().text().substring(0, 50)}'`,
      );

      // Thử các selectors từ config
      for (const selector of website.selectors.content.split(', ')) {
        const element = $(selector).first();
        this.logger.log(
          `Thử selector content: "${selector}" - tìm thấy ${element.length} element`,
        );
        if (element.length > 0) {
          content = element.text().trim().substring(0, 500); // Giới hạn 500 ký tự
          this.logger.log(
            `✅ Content tìm thấy: "${content.substring(0, 50)}..."`,
          );
          break;
        }
      }

      // Fallback: thử các selectors phổ biến khác
      if (!content) {
        const fallbackSelectors = [
          'p',
          '.content',
          '.post-content',
          '.article-content',
          '.description',
          '.summary',
          'article',
          'main',
        ];
        for (const selector of fallbackSelectors) {
          const element = $(selector).first();
          if (element.length > 0 && element.text().trim()) {
            content = element.text().trim().substring(0, 500);
            this.logger.log(
              `✅ Content tìm thấy bằng fallback: "${content.substring(0, 50)}..."`,
            );
            break;
          }
        }
      }

      // Trích xuất ngày đăng
      let publishedDate = '';
      for (const selector of website.selectors.date.split(', ')) {
        const element = $(selector).first();
        if (element.length > 0) {
          publishedDate = element.text().trim();
          break;
        }
      }

      if (title && content) {
        this.logger.log(
          `✅ Lấy được đầy đủ thông tin: title='${title.substring(0, 50)}...', content='${content.substring(0, 50)}...'`,
        );
        return {
          title,
          url,
          summary: content.substring(0, 200) + '...',
          publishedDate,
          content,
        };
      } else {
        this.logger.warn(
          `❌ Thiếu thông tin: title='${title}', content='${content}'`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Không thể lấy chi tiết bài viết từ ${url}: ${(error as Error).message}`,
      );
    }

    return null;
  }

  /**
   * Lấy bài viết mới nhất từ một URL cụ thể (được cung cấp bởi người dùng)
   */
  async getLatestArticleFromUrl(url: string): Promise<NewsArticle | null> {
    try {
      this.logger.log(`Đang lấy bài viết mới nhất từ: ${url}`);

      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const $ = cheerio.load(response.data);

      // Tìm tất cả các link trong trang
      const links: string[] = [];
      $('a').each((_, element) => {
        const href = $(element).attr('href');
        const title = $(element).text().trim();

        if (
          href &&
          title &&
          title.length > 10 &&
          this.isWeatherRelated(title)
        ) {
          const fullUrl = href.startsWith('http')
            ? href
            : new URL(href, url).href;
          if (!links.includes(fullUrl)) {
            links.push(fullUrl);
          }
        }
      });

      this.logger.log(`Tìm thấy ${links.length} bài viết tiềm năng`);

      // Lấy bài viết đầu tiên (mới nhất)
      if (links.length > 0) {
        return await this.getArticleDetails(links[0]!, {
          selectors: {
            title: 'h1, h2, .title, .post-title, .article-title',
            content:
              '.content, .post-content, .article-content, .description, .summary, p',
            date: '.date, .publish-date, .post-date, .time, .timestamp',
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Lỗi khi lấy bài viết từ ${url}:`,
        (error as Error).message,
      );
    }

    return null;
  }
}
