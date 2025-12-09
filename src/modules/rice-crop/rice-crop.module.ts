import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiceCrop } from '../../entities/rice-crop.entity';
import { RiceCropService } from './rice-crop.service';
import { RiceCropController } from './rice-crop.controller';

/**
 * Module quản lý mảnh ruộng của nông dân
 * 
 * Chức năng:
 * - Tạo và quản lý thông tin mảnh ruộng (ruộng, giống, thời gian)
 * - Theo dõi giai đoạn sinh trưởng
 * - Cập nhật trạng thái mảnh ruộng
 * - Ghi nhận kết quả thu hoạch
 * - Thống kê mảnh ruộng theo khách hàng
 */
@Module({
  imports: [TypeOrmModule.forFeature([RiceCrop])],
  controllers: [RiceCropController],
  providers: [RiceCropService],
  exports: [RiceCropService],
})
export class RiceCropModule {}
