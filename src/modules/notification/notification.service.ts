import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDevice } from '../../entities/user-devices.entity';
import { FirebaseService } from '../firebase/firebase.service';

/** Role code của Super Admin - chỉ những user này mới nhận cảnh báo hệ thống */
const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';

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
   * Gửi thông báo đến tất cả thiết bị của các tài khoản có role SUPER_ADMIN.
   * Chỉ SUPER_ADMIN mới nhận các cảnh báo hệ thống quan trọng (hết hạn, tồn kho...).
   */
  async notifyAdmins(title: string, body: string, data?: any) {
    // Lấy tất cả thiết bị active thuộc user có role SUPER_ADMIN
    const superAdminDevices = await this.deviceRepository
      .createQueryBuilder('device')
      .innerJoin('device.user', 'user')
      .innerJoin('user.role', 'role')
      .where('role.code = :roleCode', { roleCode: SUPER_ADMIN_ROLE_CODE })
      .andWhere('device.is_active = true')
      .getMany();

    this.logger.log(`📢 Gửi thông báo tới ${superAdminDevices.length} thiết bị SUPER_ADMIN...`);

    for (const device of superAdminDevices) {
      try {
        await this.firebaseService.sendPushNotification(
          device.fcm_token,
          title,
          body,
          data,
        );
      } catch (error: any) {
        this.logger.error(`❌ Failed to notify SUPER_ADMIN device ${device.id}: ${error.message}`);

        // Nếu token không còn hiệu lực, đánh dấu inactive
        if (error.code === 'messaging/registration-token-not-registered') {
          device.is_active = false;
          await this.deviceRepository.save(device);
        }
      }
    }
  }
}
