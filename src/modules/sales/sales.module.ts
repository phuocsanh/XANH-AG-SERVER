import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';

/**
 * Module quản lý bán hàng
 * Cung cấp các chức năng liên quan đến quản lý hóa đơn bán hàng và chi tiết hóa đơn
 */
@Module({
  imports: [
    // Import TypeORM feature module với các entity liên quan đến bán hàng
    TypeOrmModule.forFeature([
      SalesInvoice, // Entity quản lý hóa đơn bán hàng
      SalesInvoiceItem, // Entity quản lý chi tiết hóa đơn bán hàng
    ]),
  ],
  controllers: [SalesController], // Controller xử lý các request liên quan đến bán hàng
  providers: [SalesService], // Service xử lý logic nghiệp vụ bán hàng
  exports: [SalesService], // Xuất SalesService để các module khác có thể sử dụng
})
export class SalesModule {}
