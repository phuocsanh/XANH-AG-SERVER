import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmingSchedule } from '../../entities/farming-schedule.entity';
import { FarmingScheduleService } from './farming-schedule.service';
import { FarmingScheduleController } from './farming-schedule.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FarmingSchedule])],
  controllers: [FarmingScheduleController],
  providers: [FarmingScheduleService],
  exports: [FarmingScheduleService],
})
export class FarmingScheduleModule {}
