import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';
import { RiceBlastController } from './rice-blast.controller';
import { RiceBlastService } from './rice-blast.service';
import { Location } from '../../entities/location.entity';
import { RiceBlastWarning } from '../../entities/rice-blast-warning.entity';

/**
 * Module quản lý cảnh báo bệnh đạo ôn lúa
 * Bao gồm cron job tự động chạy mỗi ngày lúc 6:00 sáng (giờ Việt Nam)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Location, RiceBlastWarning]),
    ScheduleModule.forRoot(),
  ],
  controllers: [RiceBlastController],
  providers: [RiceBlastService],
  exports: [RiceBlastService],
})
export class RiceBlastModule implements OnModuleInit {
  private readonly logger = new Logger(RiceBlastModule.name);

  constructor(private readonly riceBlastService: RiceBlastService) {}

  /**
   * Khi module khởi động, chạy phân tích 1 lần
   */
  async onModuleInit() {
    this.logger.log('🌾 Rice Blast Warning Module initialized');
    this.logger.log('⏰ Cron job scheduled: 6:00 AM daily (Asia/Ho_Chi_Minh)');
    
    // Chạy phân tích ngay khi server khởi động
    try {
      this.logger.log('🚀 Running initial analysis on startup...');
      await this.riceBlastService.runAnalysis();
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Initial analysis failed: ${err.message}`);
    }
  }

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
      await this.riceBlastService.runAnalysis();
      this.logger.log('✅ Daily analysis completed successfully');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Daily analysis failed: ${err.message}`, err.stack);
    }
  }
}
