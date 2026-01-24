import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';
import { AiGrainDiscolorationService } from './ai-grain-discoloration.service';
import { AiGrainDiscolorationController } from './ai-grain-discoloration.controller';
import { GrainDiscolorationWarning } from '../../entities/grain-discoloration-warning.entity';
import { LocationModule } from '../location/location.module';
import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';

/**
 * Module quản lý cảnh báo Bệnh Lem Lép Hạt
 * Bao gồm cron job tự động chạy mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([GrainDiscolorationWarning]),
    ScheduleModule.forRoot(),
    LocationModule,
    AiReasoningModule,
  ],
  controllers: [AiGrainDiscolorationController],
  providers: [AiGrainDiscolorationService],
  exports: [AiGrainDiscolorationService],
})
export class AiGrainDiscolorationModule {
  private readonly logger = new Logger(AiGrainDiscolorationModule.name);

  constructor(private readonly aiGrainDiscolorationService: AiGrainDiscolorationService) {}

  /**
   * Cron job: Chạy tự động mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
   */
  @Cron('0 6 * * *', {
    name: 'grain-discoloration-daily-analysis',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailyAnalysis() {
    this.logger.log('⏰ Cron job triggered: Running daily Grain Discoloration analysis...');
    try {
      await this.aiGrainDiscolorationService.runAnalysis();
      this.logger.log('✅ Daily Grain Discoloration analysis completed successfully');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Daily Grain Discoloration analysis failed: ${err.message}`, err.stack);
    }
  }
}
