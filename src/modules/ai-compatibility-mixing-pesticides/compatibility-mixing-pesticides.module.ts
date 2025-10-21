import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CompatibilityMixingPesticidesController } from './compatibility-mixing-pesticides.controller';
import { CompatibilityMixingPesticidesService } from './compatibility-mixing-pesticides.service';

@Module({
  imports: [ConfigModule],
  controllers: [CompatibilityMixingPesticidesController],
  providers: [CompatibilityMixingPesticidesService],
})
export class CompatibilityMixingPesticidesModule {}
