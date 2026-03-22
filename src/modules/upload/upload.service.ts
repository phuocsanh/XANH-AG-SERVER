import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { FileTrackingService } from '../file-tracking/file-tracking.service';
import { UploadResponseDto } from './dto/upload-response.dto';
import { promises as fsPromises } from 'fs';
import { ALLOWED_IMAGE_TYPES, CLOUDINARY_FOLDER } from '../../common/constants/app.constants';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly fileTrackingService: FileTrackingService) {}

  async uploadImage(
    file: Express.Multer.File,
    subFolder?: string,
  ): Promise<UploadResponseDto> {
    try {
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      // Validate file type using constants
      if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type. Only ${ALLOWED_IMAGE_TYPES.join(', ')} are allowed.`,
        );
      }

      const folderPath = subFolder
        ? `${CLOUDINARY_FOLDER}/${subFolder}`
        : CLOUDINARY_FOLDER;

      // Ngưỡng 1MB - nếu ảnh lớn hơn thì server tự nén (phòng trường hợp client không nén)
      const IMAGE_SIZE_THRESHOLD = 1 * 1024 * 1024; // 1MB
      const needsCompression = file.size > IMAGE_SIZE_THRESHOLD;

      if (needsCompression) {
        this.logger.log(
          `📦 Ảnh lớn (${(file.size / 1024 / 1024).toFixed(2)}MB), tự động nén trước khi upload Cloudinary`,
        );
      }

      // Upload lên Cloudinary - chỉ transform khi ảnh lớn, ảnh nhỏ upload thẳng cho nhanh
      const uploadOptions: Record<string, any> = {
        folder: folderPath,
        resource_type: 'image',
        timeout: 60000, // 60 giây timeout cho Cloudinary SDK
      };

      // Chỉ nén khi ảnh lớn hơn ngưỡng (client quên nén hoặc gửi ảnh gốc)
      if (needsCompression) {
        uploadOptions.transformation = [
          {
            width: 1920,
            height: 1920,
            crop: 'limit', // Giới hạn kích thước, giữ nguyên tỷ lệ
          },
          {
            quality: 85, // Nén vừa phải
            fetch_format: 'jpg',
          },
        ];
      }

      const result = await cloudinary.uploader.upload(file.path, uploadOptions);

      // Clean up temporary file (async)
      try {
        await fsPromises.unlink(file.path);
      } catch (unlinkError) {
        this.logger.warn(`Failed to delete temp file: ${file.path}`);
      }

      // Save to database via file-tracking service
      const fileUpload = await this.fileTrackingService.create({
        public_id: result.public_id,
        url: result.secure_url,
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
      });

      return {
        id: fileUpload.id.toString(),
        public_id: result.public_id,
        url: fileUpload.url,
        name: fileUpload.name,
        type: fileUpload.type,
        size: fileUpload.size,
        created_at: fileUpload.created_at,
        updated_at: fileUpload.updated_at,
      };
    } catch (error) {
      // Clean up temporary file in case of error (async)
      if (file?.path) {
        try {
          await fsPromises.unlink(file.path);
        } catch (unlinkError) {
          // Ignore cleanup errors
        }
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Upload image failed: ${errorMessage}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(`Upload failed: ${errorMessage}`);
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    subFolder?: string,
  ): Promise<UploadResponseDto> {
    try {
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      const folderPath = subFolder
        ? `${CLOUDINARY_FOLDER}/${subFolder}`
        : CLOUDINARY_FOLDER;

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(file.path, {
        folder: folderPath,
        resource_type: 'auto',
      });

      // Clean up temporary file (async)
      try {
        await fsPromises.unlink(file.path);
      } catch (unlinkError) {
        this.logger.warn(`Failed to delete temp file: ${file.path}`);
      }

      // Save to database via file-tracking service
      const fileUpload = await this.fileTrackingService.create({
        public_id: result.public_id,
        url: result.secure_url,
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
      });

      return {
        id: fileUpload.id.toString(),
        public_id: result.public_id,
        url: fileUpload.url,
        name: fileUpload.name,
        type: fileUpload.type,
        size: fileUpload.size,
        created_at: fileUpload.created_at,
        updated_at: fileUpload.updated_at,
      };
    } catch (error) {
      // Clean up temporary file in case of error (async)
      if (file?.path) {
        try {
          await fsPromises.unlink(file.path);
        } catch (unlinkError) {
          // Ignore cleanup errors
        }
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Upload file failed: ${errorMessage}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(`Upload failed: ${errorMessage}`);
    }
  }

  async deleteFile(
    publicId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Thử xóa với resource_type 'raw' trước (cho file text/document)
      let result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw',
      });

      // Nếu không thành công, thử với resource_type 'image'
      if (result.result !== 'ok') {
        result = await cloudinary.uploader.destroy(publicId, {
          resource_type: 'image',
        });
      }

      // Nếu vẫn không thành công, thử với resource_type 'video'
      if (result.result !== 'ok') {
        result = await cloudinary.uploader.destroy(publicId, {
          resource_type: 'video',
        });
      }

      if (result.result !== 'ok') {
        throw new BadRequestException(
          `Failed to delete file from Cloudinary: ${result.result}`,
        );
      }

      // Delete from database
      const fileToDelete =
        await this.fileTrackingService.findByPublicId(publicId);
      if (fileToDelete) {
        await this.fileTrackingService.remove(fileToDelete.id);
      }

      return {
        success: true,
        message: 'File deleted successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Delete file failed: ${errorMessage}`, (error as Error).stack);
      throw new InternalServerErrorException(`Delete failed: ${errorMessage}`);
    }
  }

  async markFileAsUsed(
    publicId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const file = await this.fileTrackingService.findByPublicId(publicId);
      if (file) {
        await this.fileTrackingService.incrementReferenceCount(file.id);
      }

      return {
        success: true,
        message: 'File marked as used successfully',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Mark file as used failed: ${errorMessage}`, (error as Error).stack);
      throw new InternalServerErrorException(
        `Mark as used failed: ${errorMessage}`,
      );
    }
  }

  async cleanupUnusedFiles(): Promise<{
    success: boolean;
    deletedCount: number;
  }> {
    try {
      // Get orphaned files (files with reference count 0 and created more than 24 hours ago)
      const orphanedFiles = await this.fileTrackingService.findOrphanedFiles();

      let deletedCount = 0;

      for (const file of orphanedFiles) {
        try {
          // Delete from Cloudinary
          await cloudinary.uploader.destroy(file.public_id);

          // Delete from database
          await this.fileTrackingService.remove(file.id);

          deletedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to delete orphaned file ${file.public_id}`,
            (error as Error).stack,
          );
        }
      }

      this.logger.log(`Cleaned up ${deletedCount} orphaned files`);

      return {
        success: true,
        deletedCount,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Cleanup failed: ${errorMessage}`, (error as Error).stack);
      throw new InternalServerErrorException(`Cleanup failed: ${errorMessage}`);
    }
  }
}
