import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExpiryAlertService } from './expiry-alert.service';

@Injectable()
export class ExpiryCheckCron {
  private readonly logger = new Logger(ExpiryCheckCron.name);

  constructor(private readonly expiryAlertService: ExpiryAlertService) {}

  /**
   * Chạy quét hạn dùng mỗi ngày lúc 8:00 AM
   */
  @Cron('0 8 * * *')
  async handleExpiryCheck() {
    this.logger.log('⏰ Bắt đầu chạy Cron Job quét hạn dùng sản phẩm...');
    try {
      const results = await this.expiryAlertService.checkAndCreateAlerts();
      this.logger.log(`✅ Kết thúc Cron Job: Scanned ${results.scanned} lô, Created ${results.alertsCreated} cảnh báo.`);
    } catch (error: any) {
      this.logger.error(`❌ Lỗi khi chạy Cron Job quét hạn dùng: ${error.message}`);
    }
  }

  /**
   * Có thể thêm các cron jobs khác ở đây nếu cần (ví dụ: nhắc nhở hàng tuần)
   */
}
