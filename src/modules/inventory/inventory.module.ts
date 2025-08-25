import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryBatch } from '../../entities/inventory-batch.entity';
import { InventoryTransaction } from '../../entities/inventory-transaction.entity';
import { InventoryReceipt } from '../../entities/inventory-receipt.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-item.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryBatch,
      InventoryTransaction,
      InventoryReceipt,
      InventoryReceiptItem,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
