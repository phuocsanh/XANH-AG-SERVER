import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';
import { AiSheathBlightService } from './ai-sheath-blight.service';
import { AiSheathBlightController } from './ai-sheath-blight.controller';
import { SheathBlightWarning } from '../../entities/sheath-blight-warning.entity';
import { LocationModule } from '../location/location.module';
import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';

/**
 * Module quản lý cảnh báo Bệnh Đốm Vằn Lá
 * Bao gồm cron job tự động chạy mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SheathBlightWarning]),
    ScheduleModule.forRoot(),
    LocationModule,
    AiReasoningModule,
  ],
  controllers: [AiSheathBlightController],
  providers: [AiSheathBlightService],
  exports: [AiSheathBlightService],
})
export class AiSheathBlightModule {
  private readonly logger = new Logger(AiSheathBlightModule.name);

  constructor(private readonly aiSheathBlightService: AiSheathBlightService) {}

  /**
   * Cron job: Chạy tự động mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
   */
  @Cron('0 6 * * *', {
    name: 'sheath-blight-daily-analysis',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailyAnalysis() {
    this.logger.log('⏰ Cron job triggered: Running daily Sheath Blight analysis...');
    try {
      await this.aiSheathBlightService.runAnalysis();
      this.logger.log('✅ Daily Sheath Blight analysis completed successfully');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Daily Sheath Blight analysis failed: ${err.message}`, err.stack);
    }
  }
}
