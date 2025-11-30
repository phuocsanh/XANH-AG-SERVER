import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiGallMidgeService } from './ai-gall-midge.service';
import { AiGallMidgeController } from './ai-gall-midge.controller';
import { GallMidgeWarning } from '../../entities/gall-midge-warning.entity';
import { LocationModule } from '../location/location.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GallMidgeWarning]),
    LocationModule,
  ],
  controllers: [AiGallMidgeController],
  providers: [AiGallMidgeService],
  exports: [AiGallMidgeService],
})
export class AiGallMidgeModule {}
