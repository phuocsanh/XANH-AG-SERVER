import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GrowthTracking } from '../../entities/growth-tracking.entity';
import { GrowthTrackingService } from './growth-tracking.service';
import { GrowthTrackingController } from './growth-tracking.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GrowthTracking])],
  controllers: [GrowthTrackingController],
  providers: [GrowthTrackingService],
  exports: [GrowthTrackingService],
})
export class GrowthTrackingModule {}
