import { Controller, Post, Body, UseGuards, Delete } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('notification')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('register-device')
  async registerDevice(
    @CurrentUser('id') userId: number,
    @Body() body: { fcmToken: string; deviceType: 'ios' | 'android' | 'web'; deviceName?: string },
  ) {
    return this.notificationService.registerDevice(
      userId,
      body.fcmToken,
      body.deviceType,
      body.deviceName,
    );
  }

  @Delete('unregister-device')
  async unregisterDevice(@Body('fcmToken') fcmToken: string) {
    return this.notificationService.unregisterDevice(fcmToken);
  }

  @Post('test-admin-push')
  async testPush(@Body() body: { title: string; body: string }) {
    return this.notificationService.notifyAdmins(body.title, body.body);
  }
}
