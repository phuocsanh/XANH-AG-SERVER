import { Controller, Get } from '@nestjs/common';

/**
 * Health Check Controller
 * Endpoint đơn giản để kiểm tra server còn sống không
 * Dùng cho monitoring services như UptimeRobot
 */
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
