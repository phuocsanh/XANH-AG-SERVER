import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Symbol } from '../../entities/symbols.entity';
import { SymbolController } from './symbol.controller';
import { SymbolService } from './symbol.service';

/**
 * Module quản lý các ký hiệu sản phẩm
 * Cung cấp các chức năng liên quan đến quản lý ký hiệu
 */
@Module({
  imports: [TypeOrmModule.forFeature([Symbol])],
  controllers: [SymbolController],
  providers: [SymbolService],
  exports: [TypeOrmModule, SymbolService],
})
export class SymbolModule {}
