import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SalesService } from './sales.service';

@Injectable()
export class UndeliveredSalesReminderCron {
  private readonly logger = new Logger(UndeliveredSalesReminderCron.name);

  constructor(private readonly salesService: SalesService) {}

  @Cron('0 8,14 * * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleReminderCron() {
    this.logger.log('Bắt đầu quét sản phẩm trong hóa đơn chưa giao');

    try {
      const result =
        await this.salesService.sendUndeliveredSalesItemsReminderToAdmins();
      this.logger.log(
        `Kết thúc quét hàng chưa giao: ${result.invoiceCount} hóa đơn, ${result.itemCount} sản phẩm, đã gửi ${result.sent} thiết bị`,
      );
    } catch (error: any) {
      this.logger.error(
        `Lỗi cron nhắc sản phẩm chưa giao: ${error?.message || error}`,
      );
    }
  }
}
