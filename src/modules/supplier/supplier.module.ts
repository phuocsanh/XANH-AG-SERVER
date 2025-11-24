import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from '../../entities/suppliers.entity';
import { SupplierService } from './supplier.service';
import { SupplierController } from './supplier.controller';

/**
 * SupplierModule - Module quản lý nhà cung cấp
 * 
 * Module này cung cấp các chức năng:
 * - Quản lý thông tin nhà cung cấp
 * - Tạo, cập nhật, xóa nhà cung cấp
 * - Tra cứu và tìm kiếm nhà cung cấp
 * - Theo dõi lịch sử giao dịch với nhà cung cấp
 */
@Module({
  imports: [TypeOrmModule.forFeature([Supplier])],
  controllers: [SupplierController],
  providers: [SupplierService],
  exports: [SupplierService],
})
export class SupplierModule {}
