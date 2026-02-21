import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryBatch } from '../../entities/inventories.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { InventoryReceipt } from '../../entities/inventory-receipts.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { InventoryReceiptPayment } from '../../entities/inventory-receipt-payments.entity';
import { InventoryReturn } from '../../entities/inventory-returns.entity';
import { InventoryReturnItem } from '../../entities/inventory-return-items.entity';
import { InventoryReturnRefund } from '../../entities/inventory-return-refunds.entity';
import { InventoryAdjustment } from '../../entities/inventory-adjustments.entity';
import { InventoryAdjustmentItem } from '../../entities/inventory-adjustment-items.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { ProductModule } from '../product/product.module';
import { FileTrackingModule } from '../file-tracking/file-tracking.module';
import { ProductUnitConversionModule } from '../product-unit-conversion/product-unit-conversion.module';

/**
 * InventoryModule - Module quản lý kho hàng
 * 
 * Module này cung cấp các chức năng:
 * - Quản lý tồn kho theo lô hàng (batch)
 * - Ghi nhận giao dịch nhập/xuất kho
 * - Quản lý phiếu nhập kho và chi tiết phiếu nhập
 * - Tự động cập nhật số lượng tồn kho
 * - Theo dõi lịch sử biến động kho
 */
@Module({
  imports: [
    // Import TypeORM feature module với các entity liên quan đến kho hàng
    TypeOrmModule.forFeature([
      InventoryBatch, // Entity quản lý lô hàng tồn kho
      InventoryTransaction, // Entity quản lý giao dịch kho
      InventoryReceipt, // Entity quản lý phiếu nhập kho
      InventoryReceiptItem, // Entity quản lý chi tiết phiếu nhập kho
      InventoryReceiptPayment, // Entity quản lý thanh toán phiếu nhập kho
      InventoryReturn, // Entity quản lý phiếu xuất trả hàng
      InventoryReturnItem, // Entity quản lý chi tiết phiếu xuất trả hàng
      InventoryReturnRefund, // Entity quản lý hoàn tiền phiếu trả hàng
      InventoryAdjustment, // Entity quản lý phiếu điều chỉnh kho
      InventoryAdjustmentItem, // Entity quản lý chi tiết phiếu điều chỉnh kho
    ]),
    // Import ProductModule với forwardRef để tránh circular dependency
    forwardRef(() => ProductModule),
    // Import FileTrackingModule để quản lý file upload
    FileTrackingModule,
    // Import ProductUnitConversionModule để quản lý quy đổi đơn vị
    ProductUnitConversionModule,
  ],
  controllers: [InventoryController], // Controller xử lý các request liên quan đến kho hàng
  providers: [InventoryService], // Service xử lý logic nghiệp vụ kho hàng
  exports: [InventoryService], // Xuất InventoryService để các module khác có thể sử dụng
})
export class InventoryModule {}
