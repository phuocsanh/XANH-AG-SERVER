import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { SalesInvoiceItem } from '../../entities/sales-invoice-items.entity';
import { Product } from '../../entities/products.entity';
import { DebtNote } from '../../entities/debt-note.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { DebtNoteService } from '../debt-note/debt-note.service';

/**
 * SalesModule - Module quản lý bán hàng
 * 
 * Module này cung cấp các chức năng:
 * - Tạo và quản lý hóa đơn bán hàng
 * - Quản lý chi tiết sản phẩm trong hóa đơn
 * - Tính toán tổng tiền, thuế, chiết khấu
 * - Hỗ trợ thanh toán một phần và theo dõi công nợ
 * - Liên kết với khách hàng, mùa vụ và sản phẩm
 * - Tự động tính lợi nhuận mỗi đơn hàng
 */
@Module({
  imports: [
    // Import TypeOrmModule feature module với các entity liên quan đến bán hàng
    TypeOrmModule.forFeature([
      SalesInvoice, // Entity quản lý hóa đơn bán hàng
      SalesInvoiceItem, // Entity quản lý chi tiết hóa đơn bán hàng
      Product, // Entity sản phẩm (để tính giá vốn)
      DebtNote, // Entity phiếu công nợ (để tự động tạo theo mùa vụ)
    ]),
  ],
  controllers: [SalesController], // Controller xử lý các request liên quan đến bán hàng
  providers: [SalesService, DebtNoteService], // Service xử lý logic nghiệp vụ bán hàng và công nợ
  exports: [SalesService], // Xuất SalesService để các module khác có thể sử dụng
})
export class SalesModule {}
