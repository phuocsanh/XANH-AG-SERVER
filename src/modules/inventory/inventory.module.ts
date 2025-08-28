import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryBatch } from '../../entities/inventory.entity';
import { InventoryTransaction } from '../../entities/inventory-transaction.entity';
import { InventoryReceipt } from '../../entities/inventory-receipt.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-item.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { ProductModule } from '../product/product.module';

/**
 * Module quản lý kho hàng
 * Cung cấp các chức năng liên quan đến quản lý tồn kho, giao dịch kho và phiếu nhập kho
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
