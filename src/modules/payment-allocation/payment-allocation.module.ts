import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentAllocationService } from './payment-allocation.service';
import { PaymentAllocationController } from './payment-allocation.controller';
import { PaymentAllocation } from '../../entities/payment-allocation.entity';
import { Payment } from '../../entities/payment.entity';
import { SalesInvoice } from '../../entities/sales-invoices.entity';
import { DebtNote } from '../../entities/debt-note.entity';

/**
 * PaymentAllocationModule - Module quản lý phân bổ thanh toán
 * 
 * Module này cung cấp các chức năng:
 * - Phân bổ khoản thanh toán vào các hóa đơn bán hàng
 * - Phân bổ thanh toán vào các phiếu ghi nợ
 * - Tra cứu lịch sử phân bổ thanh toán
 * - Tự động tính toán và cập nhật số dư công nợ
 */
@Module({
  imports: [TypeOrmModule.forFeature([PaymentAllocation, Payment, SalesInvoice, DebtNote])],
  controllers: [PaymentAllocationController],
  providers: [PaymentAllocationService],
  exports: [PaymentAllocationService],
})
export class PaymentAllocationModule {}
