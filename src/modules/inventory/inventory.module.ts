import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryBatch } from '../../entities/inventories.entity';
import { InventoryTransaction } from '../../entities/inventory-transactions.entity';
import { InventoryReceipt } from '../../entities/inventory-receipts.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { ProductModule } from '../product/product.module';

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
    ]),
    // Import ProductModule với forwardRef để tránh circular dependency
    forwardRef(() => ProductModule),
  ],
  controllers: [InventoryController], // Controller xử lý các request liên quan đến kho hàng
  providers: [InventoryService], // Service xử lý logic nghiệp vụ kho hàng
  exports: [InventoryService], // Xuất InventoryService để các module khác có thể sử dụng
})
export class InventoryModule {}
