import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';
import { AiBrownPlantHopperService } from './ai-brown-plant-hopper.service';
import { AiBrownPlantHopperController } from './ai-brown-plant-hopper.controller';
import { BrownPlantHopperWarning } from '../../entities/brown-plant-hopper-warning.entity';
import { LocationModule } from '../location/location.module';
import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';

/**
 * Module quản lý cảnh báo Rầy Nâu
 * Bao gồm cron job tự động chạy mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([BrownPlantHopperWarning]),
    ScheduleModule.forRoot(),
    LocationModule,
    AiReasoningModule,
  ],
  controllers: [AiBrownPlantHopperController],
  providers: [AiBrownPlantHopperService],
  exports: [AiBrownPlantHopperService],
})
export class AiBrownPlantHopperModule {
  private readonly logger = new Logger(AiBrownPlantHopperModule.name);

  constructor(private readonly aiBrownPlantHopperService: AiBrownPlantHopperService) {}

  /**
   * Cron job: Chạy tự động mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
   */
  @Cron('0 6 * * *', {
    name: 'brown-plant-hopper-daily-analysis',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailyAnalysis() {
    this.logger.log('⏰ Cron job triggered: Running daily Brown Plant Hopper analysis...');
    try {
      await this.aiBrownPlantHopperService.runAnalysis();
      this.logger.log('✅ Daily Brown Plant Hopper analysis completed successfully');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Daily Brown Plant Hopper analysis failed: ${err.message}`, err.stack);
    }
  }
}
