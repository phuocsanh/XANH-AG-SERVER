import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplierReportService } from './supplier-report.service';
import { SupplierReportController } from './supplier-report.controller';
import { Supplier } from '../../entities/suppliers.entity';
import { InventoryReceiptItem } from '../../entities/inventory-receipt-items.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Supplier,
      InventoryReceiptItem,
      SalesInvoiceItem,
    ]),
  ],
  controllers: [SupplierReportController],
  providers: [SupplierReportService],
  exports: [SupplierReportService],
})
export class SupplierReportModule {}
