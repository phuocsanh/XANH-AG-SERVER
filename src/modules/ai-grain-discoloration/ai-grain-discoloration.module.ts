import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiGrainDiscolorationService } from './ai-grain-discoloration.service';
import { AiGrainDiscolorationController } from './ai-grain-discoloration.controller';
import { GrainDiscolorationWarning } from '../../entities/grain-discoloration-warning.entity';
import { LocationModule } from '../location/location.module';
import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GrainDiscolorationWarning]),
    LocationModule,
    AiReasoningModule,
  ],
  controllers: [AiGrainDiscolorationController],
  providers: [AiGrainDiscolorationService],
  exports: [AiGrainDiscolorationService],
})
export class AiGrainDiscolorationModule {}
