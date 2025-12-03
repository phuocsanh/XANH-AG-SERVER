import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiBrownPlantHopperService } from './ai-brown-plant-hopper.service';
import { AiBrownPlantHopperController } from './ai-brown-plant-hopper.controller';
import { BrownPlantHopperWarning } from '../../entities/brown-plant-hopper-warning.entity';
import { LocationModule } from '../location/location.module';

import { AiReasoningModule } from '../ai-reasoning/ai-reasoning.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BrownPlantHopperWarning]),
    LocationModule,
    AiReasoningModule, // 🆕 Import module AI trung tâm
  ],
  controllers: [AiBrownPlantHopperController],
  providers: [AiBrownPlantHopperService],
  exports: [AiBrownPlantHopperService],
})
export class AiBrownPlantHopperModule {}
