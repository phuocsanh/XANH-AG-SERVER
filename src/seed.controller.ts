import { Controller, Post, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { seedRBAC } from './database/seeds/rbac-seed';

/**
 * Controller để seed dữ liệu RBAC qua API endpoint
 * Sử dụng khi deploy lên production để tạo roles, permissions, super admin
 */
@Controller('seed')
export class SeedController {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  /**
   * Endpoint để seed RBAC (Roles, Permissions, Super Admin)
   * POST /seed/rbac
   * @returns Thông báo kết quả seed
   */
  @Post('rbac')
  async seedRBAC() {
    try {
      await seedRBAC(this.dataSource);
      return {
        success: true,
        message: '✅ Đã seed RBAC thành công! (Roles, Permissions, Super Admin)',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Lỗi khi seed RBAC',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Endpoint để seed cấu hình hệ thống ban đầu
   * POST /seed/settings
   */
  @Post('settings')
  async seedSettings() {
    try {
      const repo = this.dataSource.getRepository('SystemSetting');
      
      // Seed reward threshold
      const existingThreshold = await repo.findOne({ where: { key: 'reward_threshold' } });
      if (!existingThreshold) {
        await repo.save({
          key: 'reward_threshold',
          value: '60000000',
          description: 'Mốc tích lũy doanh số để nhận quà tặng (VND)',
        });
      }

      return {
        success: true,
        message: '✅ Đã seed cấu hình hệ thống thành công!',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Lỗi khi seed cấu hình hệ thống',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Endpoint để kiểm tra trạng thái seed
   * GET /seed/status
   * @returns Thông tin về roles và users hiện có
   */
  @Get('status')
  async getSeedStatus() {
    try {
      const roleCount = await this.dataSource
        .getRepository('Role')
        .count();
      
      const permissionCount = await this.dataSource
        .getRepository('Permission')
        .count();
      
      const userCount = await this.dataSource
        .getRepository('User')
        .count();

      return {
        success: true,
        data: {
          roles: roleCount,
          permissions: permissionCount,
          users: userCount,
          isSeeded: roleCount > 0 && permissionCount > 0 && userCount > 0,
        },
        message: roleCount > 0 ? '✅ Database đã được seed' : '⚠️ Database chưa được seed',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Lỗi khi kiểm tra trạng thái',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
