import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { Payment } from '../../entities/payment.entity';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { DebtNote } from '../../entities/debt-note.entity';
import { SalesInvoice } from '../../entities/sales-invoices.entity';

/**
 * PaymentModule - Module quản lý thanh toán
 * 
 * Module này cung cấp các chức năng:
 * - Quản lý các khoản thanh toán từ khách hàng
 * - Ghi nhận thanh toán tiền mặt, chuyển khoản
 * - Tra cứu lịch sử thanh toán
 * - Liên kết thanh toán với hóa đơn và phiếu ghi nợ
 */
@Module({
  imports: [TypeOrmModule.forFeature([
    Payment,
    PaymentAllocation,
    DebtNote,
    SalesInvoice,
  ])],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
