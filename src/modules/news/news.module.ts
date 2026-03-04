import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { News } from '../../entities/news.entity';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { FileTrackingModule } from '../file-tracking/file-tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([News]),
    FileTrackingModule,
  ],
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
