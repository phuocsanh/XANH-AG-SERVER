import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryLog } from '../../entities/delivery-log.entity';
import { UserProfile } from '../../entities/user-profiles.entity';
import { FirebaseService } from '../firebase/firebase.service';
import { DeliveryStatus } from './enums/delivery-status.enum';
import dayjs from 'dayjs';

/**
 * Service quản lý thông báo giao hàng
 * Sử dụng Dynamic Timeout để bắn thông báo đúng giờ giao hàng
 */
@Injectable()
export class DeliveryNotificationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DeliveryNotificationService.name);
  private scheduledNotifications: Map<number, NodeJS.Timeout> = new Map();

  constructor(
    @InjectRepository(DeliveryLog)
    private deliveryLogRepository: Repository<DeliveryLog>,
    @InjectRepository(UserProfile)
    private userProfileRepository: Repository<UserProfile>,
    private firebaseService: FirebaseService,
  ) {}

  /**
   * Khi server khởi động, quét lại các phiếu giao hàng sắp tới để đặt lịch
   */
  async onApplicationBootstrap() {
    this.logger.log('🔄 Đang khởi tạo lại lịch thông báo giao hàng...');
    await this.rehydrateSchedules();
  }

  /**
   * Quét database và đặt lại lịch cho các phiếu giao hàng sắp tới
   */
  private async rehydrateSchedules() {
    try {
      const today = dayjs().format('YYYY-MM-DD');
      const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');

      // Lấy các phiếu giao hàng hôm nay và ngày mai có trạng thái PENDING
      const upcomingDeliveries = await this.deliveryLogRepository.find({
        where: [
          { delivery_date: today as any, status: DeliveryStatus.PENDING },
          { delivery_date: tomorrow as any, status: DeliveryStatus.PENDING },
        ],
        relations: ['driver'],
      });

      this.logger.log(`📋 Tìm thấy ${upcomingDeliveries.length} phiếu giao hàng sắp tới`);

      for (const delivery of upcomingDeliveries) {
        this.scheduleNotification(delivery);
      }
    } catch (error) {
      this.logger.error(`❌ Lỗi khi khởi tạo lại lịch: ${error}`);
    }
  }

  /**
   * Đặt lịch thông báo cho một phiếu giao hàng
   */
  scheduleNotification(deliveryLog: DeliveryLog) {
    // Hủy lịch cũ nếu có
    this.cancelNotification(deliveryLog.id);

    // Tính thời gian còn lại đến giờ giao hàng
    const deliveryDateTime = dayjs(
      `${deliveryLog.delivery_date} ${deliveryLog.delivery_start_time}`
    );
    const now = dayjs();
    const msUntilDelivery = deliveryDateTime.diff(now);

    // Chỉ đặt lịch nếu thời gian giao hàng chưa qua
    if (msUntilDelivery > 0) {
      const timeout = setTimeout(async () => {
        await this.sendDeliveryNotification(deliveryLog);
        this.scheduledNotifications.delete(deliveryLog.id);
      }, msUntilDelivery);

      this.scheduledNotifications.set(deliveryLog.id, timeout);
      
      this.logger.log(
        `⏰ Đã đặt lịch thông báo cho phiếu #${deliveryLog.id} vào ${deliveryDateTime.format('DD/MM/YYYY HH:mm')}`
      );
    } else {
      this.logger.warn(
        `⚠️ Phiếu #${deliveryLog.id} đã quá giờ giao (${deliveryDateTime.format('DD/MM/YYYY HH:mm')})`
      );
    }
  }

  /**
   * Hủy lịch thông báo của một phiếu giao hàng
   */
  cancelNotification(deliveryLogId: number) {
    const existingTimeout = this.scheduledNotifications.get(deliveryLogId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.scheduledNotifications.delete(deliveryLogId);
      this.logger.log(`🗑️ Đã hủy lịch thông báo cho phiếu #${deliveryLogId}`);
    }
  }

  /**
   * Gửi thông báo giao hàng
   */
  private async sendDeliveryNotification(deliveryLog: DeliveryLog) {
    try {
      this.logger.log(`🚀 Bắt đầu gửi thông báo cho phiếu #${deliveryLog.id}`);

      // Load đầy đủ thông tin
      const fullDeliveryLog = await this.deliveryLogRepository.findOne({
        where: { id: deliveryLog.id },
        relations: ['driver', 'invoice', 'invoice.customer'],
      });

      if (!fullDeliveryLog) {
        this.logger.error(`❌ Không tìm thấy phiếu giao hàng #${deliveryLog.id}`);
        return;
      }

      const title = '🚚 Thông báo giao hàng';
      const body = `Bạn có đơn hàng cần giao lúc ${fullDeliveryLog.delivery_start_time} tại ${fullDeliveryLog.delivery_address || 'địa chỉ chưa xác định'}`;

      // Trường hợp 1: Có driver_id (chọn từ hệ thống)
      if (fullDeliveryLog.driver_id) {
        const driverProfile = await this.userProfileRepository.findOne({
          where: { user_id: fullDeliveryLog.driver_id },
        });

        if (driverProfile?.fcm_token) {
          await this.firebaseService.sendPushNotification(
            driverProfile.fcm_token,
            title,
            body,
            {
              delivery_log_id: fullDeliveryLog.id.toString(),
              type: 'delivery_reminder',
            }
          );
          this.logger.log(`✅ Đã gửi thông báo cho tài xế #${fullDeliveryLog.driver_id}`);
        } else {
          this.logger.warn(`⚠️ Tài xế #${fullDeliveryLog.driver_id} chưa có FCM token`);
        }
      } 
      // Trường hợp 2: Không có driver_id (nhập tay) -> Gửi cho Admin/Người tạo
      else {
        const creatorProfile = await this.userProfileRepository.findOne({
          where: { user_id: fullDeliveryLog.created_by },
        });

        if (creatorProfile?.fcm_token) {
          const adminBody = `⚠️ Đơn hàng do tài xế "${fullDeliveryLog.driver_name || 'Chưa xác định'}" (ngoài hệ thống) cần giao lúc ${fullDeliveryLog.delivery_start_time}`;
          
          await this.firebaseService.sendPushNotification(
            creatorProfile.fcm_token,
            '📢 Nhắc nhở giao hàng',
            adminBody,
            {
              delivery_log_id: fullDeliveryLog.id.toString(),
              type: 'admin_delivery_reminder',
            }
          );
          this.logger.log(`✅ Đã gửi thông báo cho Admin #${fullDeliveryLog.created_by}`);
        } else {
          this.logger.warn(`⚠️ Admin #${fullDeliveryLog.created_by} chưa có FCM token`);
        }
      }
    } catch (error) {
      this.logger.error(`❌ Lỗi khi gửi thông báo: ${error}`);
    }
  }

  /**
   * Cập nhật lịch khi phiếu giao hàng thay đổi
   */
  async onDeliveryLogUpdated(deliveryLog: DeliveryLog) {
    // Chỉ đặt lịch thông báo cho phiếu có trạng thái PENDING
    // Các trạng thái khác (DELIVERING, COMPLETED, FAILED, CANCELLED) sẽ hủy lịch
    if (deliveryLog.status !== DeliveryStatus.PENDING) {
      this.logger.log(`🔕 Hủy lịch thông báo cho phiếu #${deliveryLog.id} (Trạng thái: ${deliveryLog.status})`);
      this.cancelNotification(deliveryLog.id);
      return;
    }

    // Nếu vẫn là PENDING, đặt lại lịch với thời gian mới
    this.scheduleNotification(deliveryLog);
  }

  /**
   * Hủy lịch khi phiếu giao hàng bị xóa
   */
  async onDeliveryLogDeleted(deliveryLogId: number) {
    this.cancelNotification(deliveryLogId);
  }
}
