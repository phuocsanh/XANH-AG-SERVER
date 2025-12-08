import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaOfEachPlotOfLand } from '../../entities/area-of-each-plot-of-land.entity';
import { AreaOfEachPlotOfLandService } from './area-of-each-plot-of-land.service';
import { AreaOfEachPlotOfLandController } from './area-of-each-plot-of-land.controller';

/**
 * Module quản lý các vùng/lô đất
 */
@Module({
  imports: [TypeOrmModule.forFeature([AreaOfEachPlotOfLand])],
  controllers: [AreaOfEachPlotOfLandController],
  providers: [AreaOfEachPlotOfLandService],
  exports: [AreaOfEachPlotOfLandService],
})
export class AreaOfEachPlotOfLandModule {}
