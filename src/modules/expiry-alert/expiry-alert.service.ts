import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpiryAlert } from '../../entities/expiry-alerts.entity';
import { InventoryBatch } from '../../entities/inventories.entity';
import { NotificationService } from '../notification/notification.service';

/** Ngưỡng cảnh báo sắp hết hạn (tính bằng ngày) */
const EXPIRY_THRESHOLD_WARNING_DAYS = 120;  // 4 tháng — cảnh báo sớm
const EXPIRY_THRESHOLD_CRITICAL_DAYS = 60;  // 2 tháng — cảnh báo khẩn cấp

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
   * Quét tất cả lô hàng còn tồn kho và tạo/cập nhật cảnh báo nếu cần.
   * Ngưỡng cảnh báo: warning = dưới 4 tháng (120 ngày), critical = dưới 2 tháng (60 ngày), expired = đã hết hạn
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
      
      // Phân loại mức độ cảnh báo theo ngưỡng
      let alertType: 'warning' | 'critical' | 'expired' | null = null;
      
      if (daysUntilExpiry <= 0) {
        alertType = 'expired';
      } else if (daysUntilExpiry <= EXPIRY_THRESHOLD_CRITICAL_DAYS) {
        // Dưới 60 ngày (2 tháng) — khẩn cấp
        alertType = 'critical';
      } else if (daysUntilExpiry <= EXPIRY_THRESHOLD_WARNING_DAYS) {
        // 60–120 ngày (2–4 tháng) — cảnh báo sớm
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

          // Nếu mức độ cảnh báo leo thang (warning → critical → expired), gửi thông báo lại cho SUPER_ADMIN
          if (previousType !== alertType) {
            await this.sendExpiryNotification(
              batch.product?.name || 'Sản phẩm',
              batch.code || 'N/A',
              alertType,
              daysUntilExpiry,
              batch.remaining_quantity,
            );
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
            is_notified: true, // Đánh dấu true vì gửi ngay khi tạo
            notified_at: new Date(),
          });
          await this.alertRepository.save(newAlert);
          results.alertsCreated++;
          
          // Gửi push notification cho SUPER_ADMIN khi tạo alert mới
          await this.sendExpiryNotification(
            batch.product?.name || 'Sản phẩm',
            batch.code || 'N/A',
            alertType,
            daysUntilExpiry,
            batch.remaining_quantity,
          );
        }
      }
    }

    this.logger.log(`✅ Hoàn thành quét: ${results.scanned} lô, tạo mới ${results.alertsCreated}, cập nhật ${results.alertsUpdated}.`);
    return results;
  }

  /**
   * Lấy danh sách lô hàng theo sản phẩm (FEFO — First Expired First Out)
   */
  async getBatchesByProduct(productId: number) {
    return this.batchRepository.find({
      where: { product_id: productId },
      order: { expiry_date: 'ASC' },
    });
  }

  /**
   * Lấy danh sách cảnh báo với phân trang và bộ lọc
   */
  async getAlertsPaginated(filters: {
    status?: 'pending' | 'resolved';
    type?: 'warning' | 'critical' | 'expired';
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const query = this.alertRepository.createQueryBuilder('alert')
      .leftJoinAndSelect('alert.product', 'product')
      .leftJoinAndSelect('alert.batch', 'batch')
      .orderBy('alert.days_until_expiry', 'ASC') // Sắp xếp theo ngày hết hạn gần nhất trước
      .addOrderBy('alert.created_at', 'DESC');

    // Lọc theo trạng thái xử lý
    if (filters.status === 'resolved') {
      query.andWhere('alert.is_resolved = true');
    } else if (filters.status === 'pending') {
      query.andWhere('alert.is_resolved = false');
    }

    // Lọc theo loại cảnh báo
    if (filters.type) {
      query.andWhere('alert.alert_type = :type', { type: filters.type });
    }

    const [items, total] = await query.skip(skip).take(limit).getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Lấy lịch sử cảnh báo với filter (không phân trang — dùng cho filter đơn giản)
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
   * Lấy thống kê tổng hợp các cảnh báo hết hạn
   */
  async getAlertStats() {
    // Đếm tổng theo từng loại (chỉ tính alert chưa resolved)
    const pending = await this.alertRepository.createQueryBuilder('alert')
      .where('alert.is_resolved = false')
      .getCount();

    const warning = await this.alertRepository.createQueryBuilder('alert')
      .where('alert.is_resolved = false')
      .andWhere('alert.alert_type = :type', { type: 'warning' })
      .getCount();

    const critical = await this.alertRepository.createQueryBuilder('alert')
      .where('alert.is_resolved = false')
      .andWhere('alert.alert_type = :type', { type: 'critical' })
      .getCount();

    const expired = await this.alertRepository.createQueryBuilder('alert')
      .where('alert.is_resolved = false')
      .andWhere('alert.alert_type = :type', { type: 'expired' })
      .getCount();

    const resolved = await this.alertRepository.createQueryBuilder('alert')
      .where('alert.is_resolved = true')
      .getCount();

    return {
      total: pending + resolved,
      pending,
      warning,
      critical,
      expired,
      resolved,
    };
  }

  /**
   * Đánh dấu một cảnh báo đã xử lý (bán hết / hủy lô)
   */
  async resolveAlert(id: number, notes?: string) {
    const alert = await this.alertRepository.findOneBy({ id });
    if (!alert) return null;

    alert.is_resolved = true;
    alert.resolution_notes = notes || null;
    return this.alertRepository.save(alert);
  }

  /**
   * Đánh dấu nhiều cảnh báo đã xử lý cùng lúc
   */
  async resolveMultiple(ids: number[], notes?: string) {
    const alerts = await this.alertRepository.findByIds(ids);
    if (!alerts.length) return { resolved: 0 };

    for (const alert of alerts) {
      alert.is_resolved = true;
      alert.resolution_notes = notes || null;
    }

    await this.alertRepository.save(alerts);
    return { resolved: alerts.length };
  }

  /**
   * Gửi push notification cảnh báo hết hạn đến tất cả SUPER_ADMIN
   */
  private async sendExpiryNotification(
    productName: string,
    batchCode: string,
    type: string,
    days: number,
    quantity: number,
  ) {
    let title = '⚠️ Cảnh báo hết hạn';
    let body = '';

    if (type === 'expired') {
      title = '❌ Sản phẩm ĐÃ HẾT HẠN';
      body = `${productName} (Lô ${batchCode}) đã hết hạn! Vui lòng kiểm tra và xử lý ${quantity} sản phẩm còn lại.`;
    } else if (type === 'critical') {
      title = '🔔 Cảnh báo: Sắp hết hạn (Dưới 2 tháng)';
      body = `${productName} (Lô ${batchCode}) sẽ hết hạn sau ${days} ngày. Còn ${quantity} sản phẩm.`;
    } else {
      title = '⚠️ Thông báo: Sắp hết hạn (Dưới 4 tháng)';
      body = `${productName} (Lô ${batchCode}) sẽ hết hạn sau ${days} ngày. Còn ${quantity} sản phẩm.`;
    }

    try {
      // Chỉ gửi đến SUPER_ADMIN — xử lý trong NotificationService
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
