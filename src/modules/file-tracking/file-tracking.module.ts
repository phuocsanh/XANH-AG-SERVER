import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileUpload } from '../../entities/file-uploads.entity';
import { FileReference } from '../../entities/file-references.entity';
import { FileTrackingService } from './file-tracking.service';
import { FileTrackingController } from './file-tracking.controller';

/**
 * FileTrackingModule - Module quản lý theo dõi file
 * 
 * Module này cung cấp các chức năng:
 * - Theo dõi các file đã upload lên hệ thống
 * - Quản lý tham chiếu file với các entity khác
 * - Xóa file khi entity liên quan bị xóa
 * - Lưu trữ metadata của file (tên, kích thước, loại, URL)
 */
@Module({
  imports: [
    // Import TypeORM feature module với entity FileUpload và FileReference
    TypeOrmModule.forFeature([FileUpload, FileReference]),
  ],
  controllers: [FileTrackingController], // Controller xử lý các request liên quan đến file tracking
  providers: [FileTrackingService], // Service xử lý logic nghiệp vụ file tracking
  exports: [FileTrackingService], // Xuất FileTrackingService để các module khác có thể sử dụng
})
export class FileTrackingModule {}
