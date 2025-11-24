import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { Customer } from '../../entities/customer.entity';

/**
 * CustomerModule - Module quản lý khách hàng
 * 
 * Module này cung cấp các chức năng:
 * - Quản lý thông tin khách hàng
 * - Tạo, cập nhật, xóa khách hàng
 * - Tra cứu và tìm kiếm khách hàng
 * - Theo dõi lịch sử mua hàng và công nợ
 */
@Module({
  imports: [TypeOrmModule.forFeature([Customer])],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
