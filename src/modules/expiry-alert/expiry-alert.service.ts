import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpiryAlert } from '../../entities/expiry-alerts.entity';
import { InventoryBatch } from '../../entities/inventories.entity';
import { NotificationService } from '../notification/notification.service';


@Injectable()
export class ExpiryAlertService {
  private readonly logger = new Logger(ExpiryAlertService.name);

  constructor(
    @InjectRepository(ExpiryAlert)
    private readonly alertRepository: Repository<ExpiryAlert>,
    @InjectRepository(InventoryBatch)
    private readonly batchRepository: Repository<InventoryBatch>,
    private readonly notificationService: NotificationService,
  ) {}


  /**
   * Quét tất cả lô hàng và tạo cảnh báo nếu cần
   */
  async checkAndCreateAlerts() {
    this.logger.log('🕵️ Đang quét hạn dùng các lô hàng...');
    const now = new Date();
    
    // Lấy các lô hàng còn tồn kho và có hạn dùng
    const batchesWithStock = await this.batchRepository.createQueryBuilder('batch')
      .leftJoinAndSelect('batch.product', 'product')
      .where('batch.remaining_quantity > 0')
      .andWhere('batch.expiry_date IS NOT NULL')
      .getMany();

    const results = {
      scanned: batchesWithStock.length,
      alertsCreated: 0,
      alertsUpdated: 0,
    };

    for (const batch of batchesWithStock) {
      if (!batch.expiry_date) continue;
      
      const expiryDate = new Date(batch.expiry_date);
      const timeDiff = expiryDate.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      let alertType: 'warning' | 'critical' | 'expired' | null = null;
      
      if (daysUntilExpiry <= 0) {
        alertType = 'expired';
      } else if (daysUntilExpiry <= 30) {
        alertType = 'critical';
      } else if (daysUntilExpiry <= 60) {
        alertType = 'warning';
      }

      if (alertType) {
        // Kiểm tra xem đã có alert chưa resolved cho lô này chưa
        let alert = await this.alertRepository.findOne({
          where: { batch_id: batch.id, is_resolved: false },
        });

        if (alert) {
          const previousType = alert.alert_type;
          // Cập nhật alert hiện có nếu status hoặc quantity thay đổi
          alert.alert_type = alertType;
          alert.days_until_expiry = daysUntilExpiry;
          alert.remaining_quantity = batch.remaining_quantity;
          await this.alertRepository.save(alert);
          results.alertsUpdated++;

          // Nếu mức độ cảnh báo tăng lên (ví dụ từ warning lên critical), gửi thông báo lại
          if (previousType !== alertType) {
            await this.sendExpiryNotification(batch.product?.name || 'Sản phẩm', batch.code || 'N/A', alertType, daysUntilExpiry, batch.remaining_quantity);
          }
        } else {
          // Tạo mới alert
          const newAlert = this.alertRepository.create({
            product_id: batch.product_id,
            batch_id: batch.id,
            expiry_date: batch.expiry_date,
            remaining_quantity: batch.remaining_quantity,
            alert_type: alertType,
            days_until_expiry: daysUntilExpiry,
            is_notified: true, // Đánh dấu true vì chúng ta gửi ngay khi tạo
            notified_at: new Date(),
          });
          await this.alertRepository.save(newAlert);
          results.alertsCreated++;
          
          // Gửi notification cho alert mới
          await this.sendExpiryNotification(batch.product?.name || 'Sản phẩm', batch.code || 'N/A', alertType, daysUntilExpiry, batch.remaining_quantity);
        }
      }
    }

    this.logger.log(`✅ Hoàn thành quét: ${results.scanned} lô, tạo mới ${results.alertsCreated}, cập nhật ${results.alertsUpdated}.`);
    return results;
  }

  /**
   * Lấy danh sách lô hàng theo sản phẩm (FEFO)
   */
  async getBatchesByProduct(productId: number) {
    return this.batchRepository.find({
      where: { product_id: productId },
      order: { expiry_date: 'ASC' },
    });
  }

  /**
   * Lấy lịch sử cảnh báo với filter
   */
  async getAlertHistory(filters: any) {
    const query = this.alertRepository.createQueryBuilder('alert')
      .leftJoinAndSelect('alert.product', 'product')
      .leftJoinAndSelect('alert.batch', 'batch')
      .orderBy('alert.created_at', 'DESC');

    if (filters.status === 'resolved') {
      query.andWhere('alert.is_resolved = true');
    } else if (filters.status === 'pending') {
      query.andWhere('alert.is_resolved = false');
    }

    if (filters.type) {
      query.andWhere('alert.alert_type = :type', { type: filters.type });
    }

    return query.getMany();
  }

  /**
   * Đánh dấu cảnh báo đã xử lý
   */
  async resolveAlert(id: number, notes?: string) {
    const alert = await this.alertRepository.findOneBy({ id });
    if (!alert) return null;

    alert.is_resolved = true;
    alert.resolution_notes = notes || null;
    return this.alertRepository.save(alert);
  }

  /**
   * helper gửi thông báo
   */
  private async sendExpiryNotification(productName: string, batchCode: string, type: string, days: number, quantity: number) {
    let title = '⚠️ Cảnh báo hết hạn';
    let body = '';

    if (type === 'expired') {
      title = '❌ Sản phẩm ĐÃ HẾT HẠN';
      body = `${productName} (Lô ${batchCode}) đã hết hạn! Vui lòng kiểm tra và xử lý ${quantity} sản phẩm còn lại.`;
    } else if (type === 'critical') {
      title = '🔔 Cảnh báo: Sắp hết hạn (Dưới 30 ngày)';
      body = `${productName} (Lô ${batchCode}) sẽ hết hạn sau ${days} ngày. Còn ${quantity} sản phẩm.`;
    } else {
      title = '⚠️ Thông báo: Sắp hết hạn (60 ngày)';
      body = `${productName} (Lô ${batchCode}) sẽ hết hạn sau ${days} ngày.`;
    }

    try {
      await this.notificationService.notifyAdmins(title, body, {
        type: 'expiry_alert',
        productName,
        batchCode,
      });
    } catch (error: any) {
      this.logger.error(`❌ Lỗi gửi thông báo cho ${productName}: ${error.message}`);
    }
  }
}
