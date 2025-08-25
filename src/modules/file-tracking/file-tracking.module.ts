import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileUpload } from '../../entities/file-upload.entity';
import { FileTrackingService } from './file-tracking.service';
import { FileTrackingController } from './file-tracking.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FileUpload])],
  controllers: [FileTrackingController],
  providers: [FileTrackingService],
  exports: [FileTrackingService],
})
export class FileTrackingModule {}