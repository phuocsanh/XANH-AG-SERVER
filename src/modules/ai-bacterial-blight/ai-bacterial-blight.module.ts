import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';
import { AiBacterialBlightController } from './ai-bacterial-blight.controller';
import { AiBacterialBlightService } from './ai-bacterial-blight.service';
import { BacterialBlightWarning } from '../../entities/bacterial-blight-warning.entity';
import { LocationModule } from '../location/location.module';

import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';

/**
 * Module quản lý cảnh báo bệnh cháy bìa lá do vi khuẩn
 * Bao gồm cron job tự động chạy mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
 * Không tự động chạy khi khởi động server
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([BacterialBlightWarning]),
    ScheduleModule.forRoot(),
    LocationModule, // Import LocationModule để sử dụng LocationService
    AiReasoningModule, // 🆕 Import module AI trung tâm
  ],
  controllers: [AiBacterialBlightController],
  providers: [AiBacterialBlightService],
  exports: [AiBacterialBlightService],
})
export class AiBacterialBlightModule {
  private readonly logger = new Logger(AiBacterialBlightModule.name);

  constructor(private readonly aiBacterialBlightService: AiBacterialBlightService) {}

  /**
   * Cron job: Chạy tự động mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
   */
  @Cron('0 6 * * *', {
    name: 'bacterial-blight-daily-analysis',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailyAnalysis() {
    this.logger.log('⏰ Cron job triggered: Running daily bacterial blight analysis...');
    try {
      await this.aiBacterialBlightService.runAnalysis();
      this.logger.log('✅ Daily analysis completed successfully');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Daily analysis failed: ${err.message}`, err.stack);
    }
  }
}
