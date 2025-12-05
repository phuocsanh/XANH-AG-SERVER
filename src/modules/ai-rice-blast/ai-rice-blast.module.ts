import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';
import { AiRiceBlastController } from './ai-rice-blast.controller';
import { AiRiceBlastService } from './ai-rice-blast.service';
import { RiceBlastWarning } from '../../entities/rice-blast-warning.entity';
import { LocationModule } from '../location/location.module';

import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';

/**
 * Module quản lý cảnh báo bệnh đạo ôn lúa
 * Bao gồm cron job tự động chạy mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
 * Không tự động chạy khi khởi động server
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([RiceBlastWarning]),
    ScheduleModule.forRoot(),
    LocationModule, // Import LocationModule để sử dụng LocationService
    AiReasoningModule, // 🆕 Import module AI trung tâm
  ],
  controllers: [AiRiceBlastController],
  providers: [AiRiceBlastService],
  exports: [AiRiceBlastService],
})
export class AiRiceBlastModule {
  private readonly logger = new Logger(AiRiceBlastModule.name);

  constructor(private readonly aiRiceBlastService: AiRiceBlastService) {}

  /**
   * Cron job: Chạy tự động mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
   * Cron expression: '0 6 * * *' = phút 0, giờ 6, mọi ngày, mọi tháng, mọi năm
   */
  @Cron('0 6 * * *', {
    name: 'rice-blast-daily-analysis',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailyAnalysis() {
    this.logger.log('⏰ Cron job triggered: Running daily rice blast analysis...');
    try {
      await this.aiRiceBlastService.runAnalysis();
      this.logger.log('✅ Daily analysis completed successfully');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Daily analysis failed: ${err.message}`, err.stack);
    }
  }
}
