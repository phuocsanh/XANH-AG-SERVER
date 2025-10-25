import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Symbol } from '../../entities/symbols.entity';

/**
 * Module quản lý các ký hiệu sản phẩm
 * Cung cấp các chức năng liên quan đến quản lý ký hiệu
 */
@Module({
  imports: [TypeOrmModule.forFeature([Symbol])],
  exports: [TypeOrmModule],
})
export class SymbolModule {}
