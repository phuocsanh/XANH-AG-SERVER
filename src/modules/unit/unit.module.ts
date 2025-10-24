import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Unit } from '../../entities/unit.entity';
import { UnitService } from './unit.service';
import { UnitController } from './unit.controller';

/**
 * Module quản lý đơn vị tính
 * Cung cấp các chức năng liên quan đến quản lý thông tin đơn vị tính
 */
@Module({
  imports: [
    // Import TypeORM feature module với entity Unit
    TypeOrmModule.forFeature([Unit]),
  ],
  controllers: [UnitController], // Controller xử lý các request liên quan đến đơn vị tính
  providers: [UnitService], // Service xử lý logic nghiệp vụ đơn vị tính
  exports: [UnitService], // Xuất UnitService để các module khác có thể sử dụng
})
export class UnitModule {}
