import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiBrownPlantHopperService } from './ai-brown-plant-hopper.service';
import { AiBrownPlantHopperController } from './ai-brown-plant-hopper.controller';
import { BrownPlantHopperWarning } from '../../entities/brown-plant-hopper-warning.entity';
import { LocationModule } from '../location/location.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BrownPlantHopperWarning]),
    LocationModule,
  ],
  controllers: [AiBrownPlantHopperController],
  providers: [AiBrownPlantHopperService],
  exports: [AiBrownPlantHopperService],
})
export class AiBrownPlantHopperModule {}
