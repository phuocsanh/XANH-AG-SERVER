import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileUpload } from '../../entities/file-upload.entity';
import { FileTrackingService } from './file-tracking.service';
import { FileTrackingController } from './file-tracking.controller';

/**
 * Module quản lý theo dõi file
 * Cung cấp các chức năng liên quan đến quản lý file upload
 */
@Module({
  imports: [
    // Import TypeORM feature module với entity FileUpload
    TypeOrmModule.forFeature([FileUpload]),
  ],
  controllers: [FileTrackingController], // Controller xử lý các request liên quan đến file tracking
  providers: [FileTrackingService], // Service xử lý logic nghiệp vụ file tracking
  exports: [FileTrackingService], // Xuất FileTrackingService để các module khác có thể sử dụng
})
export class FileTrackingModule {}
