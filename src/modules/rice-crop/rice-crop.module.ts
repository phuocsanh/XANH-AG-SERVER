import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiceCrop } from '../../entities/rice-crop.entity';
import { ExternalPurchase, ExternalPurchaseItem } from '../../entities/external-purchase.entity';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { RiceCropService } from './rice-crop.service';
import { RiceCropController } from './rice-crop.controller';
import { PurchaseMergeService } from './purchase-merge.service';

/**
 * Module quản lý mảnh ruộng của nông dân
 * 
 * Chức năng:
 * - Tạo và quản lý thông tin mảnh ruộng (ruộng, giống, thời gian)
 * - Theo dõi giai đoạn sinh trưởng
 * - Cập nhật trạng thái mảnh ruộng
 * - Ghi nhận kết quả thu hoạch
 * - Thống kê mảnh ruộng theo khách hàng
 * - Quản lý hóa đơn mua hàng (system + external)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RiceCrop,
      ExternalPurchase,
      ExternalPurchaseItem,
      SalesInvoice,
    ]),
  ],
  controllers: [RiceCropController],
  providers: [RiceCropService, PurchaseMergeService],
  exports: [RiceCropService],
})
export class RiceCropModule {}
