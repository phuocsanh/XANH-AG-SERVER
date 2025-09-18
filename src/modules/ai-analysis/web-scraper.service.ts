import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Service để scrape dữ liệu từ các website
 * Hỗ trợ lấy thông tin thị trường lúa gạo từ các nguồn trực tuyến
 */
@Injectable()
export class WebScraperService {
  private readonly logger = new Logger(WebScraperService.name);

  /**
   * Lấy nội dung HTML từ một URL
   * @param url - URL cần scrape
   * @returns Promise<string> - Nội dung HTML
   */
  async fetchWebContent(url: string): Promise<string> {
    try {
      this.logger.log(`Đang fetch dữ liệu từ: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 10000, // 10 giây timeout
      });

      this.logger.log(`Fetch thành công từ ${url}, kích thước: ${response.data.length} bytes`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Lỗi khi fetch từ ${url}:`, error.message);
      throw new Error(`Không thể lấy dữ liệu từ ${url}: ${error.message}`);
    }
  }

  /**
   * Trích xuất text từ HTML content
   * @param html - Nội dung HTML
   * @param selector - CSS selector để lấy nội dung cụ thể (optional)
   * @returns string - Text đã được làm sạch
   */
  extractTextFromHtml(html: string, selector?: string): string {
    try {
      const $ = cheerio.load(html);
      
      // Xóa các thẻ script và style
      $('script, style, nav, header, footer, aside').remove();
      
      let text: string;
      if (selector) {
        text = $(selector).text();
      } else {
        text = $('body').text();
      }
      
      // Làm sạch text: loại bỏ khoảng trắng thừa, xuống dòng thừa
      text = text
        .replace(/\s+/g, ' ') // Thay thế nhiều khoảng trắng bằng 1 khoảng trắng
        .replace(/\n\s*\n/g, '\n') // Loại bỏ dòng trống thừa
        .trim();
      
      this.logger.log(`Trích xuất được ${text.length} ký tự text`);
      return text;
    } catch (error: any) {
      this.logger.error('Lỗi khi trích xuất text từ HTML:', error.message);
      throw new Error(`Không thể trích xuất text: ${error.message}`);
    }
  }

  /**
   * Lấy thông tin cụ thể từ website dựa trên các selector
   * @param url - URL cần scrape
   * @param selectors - Object chứa các CSS selector
   * @returns Promise<any> - Object chứa dữ liệu đã trích xuất
   */
  async scrapeStructuredData(url: string, selectors: Record<string, string>): Promise<any> {
    try {
      const html = await this.fetchWebContent(url);
      const $ = cheerio.load(html);
      const result: any = {};

      for (const [key, selector] of Object.entries(selectors)) {
        try {
          const elements = $(selector);
          if (elements.length > 1) {
            // Nếu có nhiều element, lấy tất cả
            result[key] = elements.map((_, el) => $(el).text().trim()).get();
          } else {
            // Nếu chỉ có 1 element, lấy text
            result[key] = elements.text().trim();
          }
        } catch (selectorError) {
          this.logger.warn(`Không thể lấy dữ liệu cho selector ${key}: ${selector}`);
          result[key] = null;
        }
      }

      this.logger.log(`Scrape structured data thành công từ ${url}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Lỗi khi scrape structured data từ ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * Lấy tất cả links từ một trang web
   * @param url - URL cần scrape
   * @param baseUrl - Base URL để tạo absolute links
   * @returns Promise<string[]> - Danh sách các links
   */
  async extractLinks(url: string, baseUrl?: string): Promise<string[]> {
    try {
      const html = await this.fetchWebContent(url);
      const $ = cheerio.load(html);
      const links: string[] = [];

      $('a[href]').each((_, element) => {
        let href = $(element).attr('href');
        if (href) {
          // Tạo absolute URL nếu cần
          if (href.startsWith('/') && baseUrl) {
            href = baseUrl + href;
          } else if (href.startsWith('//')) {
            href = 'https:' + href;
          } else if (!href.startsWith('http')) {
            if (baseUrl) {
              href = baseUrl + '/' + href;
            }
          }
          
          if (href.startsWith('http')) {
            links.push(href);
          }
        }
      });

      const uniqueLinks = [...new Set(links)]; // Loại bỏ duplicate
      this.logger.log(`Tìm thấy ${uniqueLinks.length} links từ ${url}`);
      return uniqueLinks;
    } catch (error: any) {
      this.logger.error(`Lỗi khi extract links từ ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * Kiểm tra xem URL có hợp lệ không
   * @param url - URL cần kiểm tra
   * @returns boolean
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lấy domain từ URL
   * @param url - URL
   * @returns string - Domain name
   */
  getDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }
}