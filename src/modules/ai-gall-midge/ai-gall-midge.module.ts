import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';
import { AiGallMidgeService } from './ai-gall-midge.service';
import { AiGallMidgeController } from './ai-gall-midge.controller';
import { GallMidgeWarning } from '../../entities/gall-midge-warning.entity';
import { LocationModule } from '../location/location.module';
import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';

/**
 * Module quản lý cảnh báo Muỗi Hành
 * Bao gồm cron job tự động chạy mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([GallMidgeWarning]),
    ScheduleModule.forRoot(),
    LocationModule,
    AiReasoningModule,
  ],
  controllers: [AiGallMidgeController],
  providers: [AiGallMidgeService],
  exports: [AiGallMidgeService],
})
export class AiGallMidgeModule {
  private readonly logger = new Logger(AiGallMidgeModule.name);

  constructor(private readonly aiGallMidgeService: AiGallMidgeService) {}

  /**
   * Cron job: Chạy tự động mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
   */
  @Cron('0 6 * * *', {
    name: 'gall-midge-daily-analysis',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailyAnalysis() {
    this.logger.log('⏰ Cron job triggered: Running daily Gall Midge analysis...');
    try {
      await this.aiGallMidgeService.runAnalysis();
      this.logger.log('✅ Daily Gall Midge analysis completed successfully');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Daily Gall Midge analysis failed: ${err.message}`, err.stack);
    }
  }
}
