import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HarvestRecord } from '../../entities/harvest-record.entity';
import { HarvestRecordService } from './harvest-record.service';
import { HarvestRecordController } from './harvest-record.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HarvestRecord])],
  controllers: [HarvestRecordController],
  providers: [HarvestRecordService],
  exports: [HarvestRecordService],
})
export class HarvestRecordModule {}
