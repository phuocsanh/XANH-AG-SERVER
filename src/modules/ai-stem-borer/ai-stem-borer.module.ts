import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiStemBorerService } from './ai-stem-borer.service';
import { AiStemBorerController } from './ai-stem-borer.controller';
import { StemBorerWarning } from '../../entities/stem-borer-warning.entity';
import { LocationModule } from '../location/location.module';
import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StemBorerWarning]),
    LocationModule,
    AiReasoningModule,
  ],
  controllers: [AiStemBorerController],
  providers: [AiStemBorerService],
  exports: [AiStemBorerService],
})
export class AiStemBorerModule {}
