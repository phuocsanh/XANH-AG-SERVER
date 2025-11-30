import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiGrainDiscolorationService } from './ai-grain-discoloration.service';
import { AiGrainDiscolorationController } from './ai-grain-discoloration.controller';
import { GrainDiscolorationWarning } from '../../entities/grain-discoloration-warning.entity';
import { LocationModule } from '../location/location.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GrainDiscolorationWarning]),
    LocationModule,
  ],
  controllers: [AiGrainDiscolorationController],
  providers: [AiGrainDiscolorationService],
  exports: [AiGrainDiscolorationService],
})
export class AiGrainDiscolorationModule {}
