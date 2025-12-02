import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationRecord } from '../../entities/application-record.entity';
import { ApplicationRecordService } from './application-record.service';
import { ApplicationRecordController } from './application-record.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ApplicationRecord])],
  controllers: [ApplicationRecordController],
  providers: [ApplicationRecordService],
  exports: [ApplicationRecordService],
})
export class ApplicationRecordModule {}
