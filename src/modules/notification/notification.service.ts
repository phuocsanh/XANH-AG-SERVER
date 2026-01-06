import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '../../entities/user-devices.entity';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(UserDevice)
    private readonly deviceRepository: Repository<UserDevice>,
    private readonly firebaseService: FirebaseService,
  ) {}

  /**
   * Lưu hoặc cập nhật FCM token của user
   */
  async registerDevice(userId: number, fcmToken: string, deviceType: 'ios' | 'android' | 'web', deviceName?: string) {
    let device = await this.deviceRepository.findOne({
      where: { fcm_token: fcmToken },
    });

    if (device) {
      device.user_id = userId;
      device.device_type = deviceType;
      device.device_name = deviceName || null;
      device.is_active = true;
      device.last_used_at = new Date();
      return this.deviceRepository.save(device);
    } else {
      const newDevice = this.deviceRepository.create({
        user_id: userId,
        fcm_token: fcmToken,
        device_type: deviceType,
        device_name: deviceName || null,
        is_active: true,
        last_used_at: new Date(),
      } as any);
      return this.deviceRepository.save(newDevice);
    }
  }

  /**
   * Hủy kích hoạt token (khi logout)
   */
  async unregisterDevice(fcmToken: string) {
    const device = await this.deviceRepository.findOne({
      where: { fcm_token: fcmToken },
    });

    if (device) {
      device.is_active = false;
      await this.deviceRepository.save(device);
    }
  }

  /**
   * Gửi thông báo đến tất cả thiết bị của một user
   */
  async notifyUser(userId: number, title: string, body: string, data?: any) {
    const devices = await this.deviceRepository.find({
      where: { user_id: userId, is_active: true },
    });

    const results: Array<{ deviceId: number, success: boolean, result?: any, error?: string }> = [];
    for (const device of devices) {
      try {
        const result = await this.firebaseService.sendPushNotification(
          device.fcm_token,
          title,
          body,
          data,
        );
        results.push({ deviceId: device.id, success: true, result });
      } catch (error: any) {
        this.logger.error(`❌ Failed to notify device ${device.id}: ${error.message}`);
        results.push({ deviceId: device.id, success: false, error: error.message });
        
        // Nếu token không còn hiệu lực, đánh dấu inactive
        if (error.code === 'messaging/registration-token-not-registered') {
          device.is_active = false;
          await this.deviceRepository.save(device);
        }
      }
    }
    return results;
  }

  /**
   * Gửi thông báo đến tất cả Admin
   */
  async notifyAdmins(title: string, body: string, data?: any) {
    // Trong dự án này, chúng ta có thể lấy users có role admin
    // Giả sử có cách lấy admin ids, hoặc đơn giản là gửi cho tất cả devices đang active (cho quy mô nhỏ)
    const activeDevices = await this.deviceRepository.find({
      where: { is_active: true },
    });

    this.logger.log(`📢 Gửi thông báo tới ${activeDevices.length} thiết bị đang hoạt động...`);
    
    for (const device of activeDevices) {
      try {
        await this.firebaseService.sendPushNotification(
          device.fcm_token,
          title,
          body,
          data,
        );
      } catch (error: any) {
        this.logger.error(`❌ Failed to notify device ${device.id}: ${error.message}`);
      }
    }
  }
}
