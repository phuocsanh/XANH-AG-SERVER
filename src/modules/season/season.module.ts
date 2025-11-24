import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeasonController } from './season.controller';
import { SeasonService } from './season.service';
import { Season } from '../../entities/season.entity';

/**
 * SeasonModule - Module quản lý mùa vụ
 * 
 * Module này cung cấp các chức năng:
 * - Quản lý thông tin các mùa vụ (Đông Xuân, Hè Thu, Thu Đông)
 * - Tạo, cập nhật, xóa mùa vụ
 * - Tra cứu và tìm kiếm mùa vụ
 * - Liên kết mùa vụ với hóa đơn bán hàng để theo dõi doanh thu theo mùa
 */
@Module({
  imports: [TypeOrmModule.forFeature([Season])],
  controllers: [SeasonController],
  providers: [SeasonService],
  exports: [SeasonService],
})
export class SeasonModule {}
