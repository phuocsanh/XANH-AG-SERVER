import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiGallMidgeService } from './ai-gall-midge.service';
import { AiGallMidgeController } from './ai-gall-midge.controller';
import { GallMidgeWarning } from '../../entities/gall-midge-warning.entity';
import { LocationModule } from '../location/location.module';
import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GallMidgeWarning]),
    LocationModule,
    AiReasoningModule, // 🆕 Import module AI trung tâm
  ],
  controllers: [AiGallMidgeController],
  providers: [AiGallMidgeService],
  exports: [AiGallMidgeService],
})
export class AiGallMidgeModule {}
