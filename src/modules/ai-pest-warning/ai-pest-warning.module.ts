import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule, Cron } from '@nestjs/schedule';
import { AiPestWarningController } from './ai-pest-warning.controller';
import { AiPestWarningService } from './ai-pest-warning.service';
import { PestWarning } from '../../entities/pest-warning.entity';
import { LocationModule } from '../location/location.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PestWarning]),
    ScheduleModule.forRoot(),
    LocationModule,
  ],
  controllers: [AiPestWarningController],
  providers: [AiPestWarningService],
  exports: [AiPestWarningService],
})
export class AiPestWarningModule implements OnModuleInit {
  private readonly logger = new Logger(AiPestWarningModule.name);

  constructor(private readonly aiPestWarningService: AiPestWarningService) {}

  async onModuleInit() {
    this.logger.log('🐛 Pest Warning Module initialized');
    try {
      await this.aiPestWarningService.runAnalysis();
    } catch (error) {
      this.logger.error('Initial pest analysis failed');
    }
  }

  @Cron('0 6 * * *', {
    name: 'pest-warning-daily-analysis',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailyAnalysis() {
    this.logger.log('⏰ Running daily pest analysis...');
    try {
      await this.aiPestWarningService.runAnalysis();
    } catch (error) {
      this.logger.error('Daily pest analysis failed');
    }
  }
}
