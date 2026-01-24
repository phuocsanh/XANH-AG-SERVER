import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';
import { AiStemBorerService } from './ai-stem-borer.service';
import { AiStemBorerController } from './ai-stem-borer.controller';
import { StemBorerWarning } from '../../entities/stem-borer-warning.entity';
import { LocationModule } from '../location/location.module';
import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';

/**
 * Module quản lý cảnh báo Sâu Đục Thân
 * Bao gồm cron job tự động chạy mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([StemBorerWarning]),
    ScheduleModule.forRoot(),
    LocationModule,
    AiReasoningModule,
  ],
  controllers: [AiStemBorerController],
  providers: [AiStemBorerService],
  exports: [AiStemBorerService],
})
export class AiStemBorerModule {
  private readonly logger = new Logger(AiStemBorerModule.name);

  constructor(private readonly aiStemBorerService: AiStemBorerService) {}

  /**
   * Cron job: Chạy tự động mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
   */
  @Cron('0 6 * * *', {
    name: 'stem-borer-daily-analysis',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailyAnalysis() {
    this.logger.log('⏰ Cron job triggered: Running daily Stem Borer analysis...');
    try {
      await this.aiStemBorerService.runAnalysis();
      this.logger.log('✅ Daily Stem Borer analysis completed successfully');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Daily Stem Borer analysis failed: ${err.message}`, err.stack);
    }
  }
}
