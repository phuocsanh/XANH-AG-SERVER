import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesReturnService } from './sales-return.service';
import { SalesReturnController } from './sales-return.controller';
import { SalesReturn } from '../../entities/sales-return.entity';
import { SalesReturnItem } from '../../entities/sales-return-items.entity';
import { SalesInvoice } from '../../entities/sales-invoices.entity';

/**
 * SalesReturnModule - Module quản lý trả hàng
 * 
 * Module này cung cấp các chức năng:
 * - Quản lý phiếu trả hàng từ khách hàng
 * - Ghi nhận chi tiết sản phẩm trả lại
 * - Liên kết với hóa đơn bán hàng gốc
 * - Tự động cập nhật tồn kho và công nợ khi trả hàng
 */
@Module({
  imports: [TypeOrmModule.forFeature([SalesReturn, SalesReturnItem, SalesInvoice])],
  controllers: [SalesReturnController],
  providers: [SalesReturnService],
  exports: [SalesReturnService],
})
export class SalesReturnModule {}
