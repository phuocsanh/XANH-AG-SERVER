import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiSheathBlightService } from './ai-sheath-blight.service';
import { AiSheathBlightController } from './ai-sheath-blight.controller';
import { SheathBlightWarning } from '../../entities/sheath-blight-warning.entity';
import { LocationModule } from '../location/location.module';
import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SheathBlightWarning]),
    LocationModule,
    AiReasoningModule,
  ],
  controllers: [AiSheathBlightController],
  providers: [AiSheathBlightService],
  exports: [AiSheathBlightService],
})
export class AiSheathBlightModule {}
