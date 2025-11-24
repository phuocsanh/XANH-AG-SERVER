import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { CloudinaryProvider } from './cloudinary.provider';
import { FileTrackingModule } from '../file-tracking/file-tracking.module';

/**
 * UploadModule - Module quản lý upload file
 * 
 * Module này cung cấp các chức năng:
 * - Upload file lên Cloudinary
 * - Xử lý và tối ưu hóa hình ảnh
 * - Xóa file khỏi Cloudinary
 * - Tích hợp với FileTracking để theo dõi file
 */
@Module({
  imports: [FileTrackingModule],
  controllers: [UploadController],
  providers: [UploadService, CloudinaryProvider],
  exports: [UploadService],
})
export class UploadModule {}