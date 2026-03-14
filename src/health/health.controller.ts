import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Health Check Controller
 * Endpoint đơn giản để kiểm tra server còn sống không
 * Dùng cho monitoring services như UptimeRobot
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
