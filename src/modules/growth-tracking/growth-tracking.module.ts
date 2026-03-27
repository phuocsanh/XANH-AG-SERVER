import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GrowthTracking } from '../../entities/growth-tracking.entity';
import { GrowthTrackingService } from './growth-tracking.service';
import { GrowthTrackingController } from './growth-tracking.controller';
import { FileTrackingModule } from '../file-tracking/file-tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GrowthTracking]),
    FileTrackingModule,
  ],
  controllers: [GrowthTrackingController],
  providers: [GrowthTrackingService],
  exports: [GrowthTrackingService],
})
export class GrowthTrackingModule {}
