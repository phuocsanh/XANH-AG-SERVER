import { Injectable, Inject, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { FileTrackingService } from '../file-tracking/file-tracking.service';
import { UploadResponseDto } from './dto/upload-response.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
  constructor(
    @Inject('CLOUDINARY') private cloudinaryConfig: any,
    private readonly fileTrackingService: FileTrackingService,
  ) {}

  async uploadImage(file: any): Promise<UploadResponseDto> {
    try {
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException('Invalid file type. Only images are allowed.');
      }

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'gn-farm',
        resource_type: 'image',
      });

      // Clean up temporary file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      // Save to database via file-tracking service
      const fileUpload = await this.fileTrackingService.create({
        publicId: result.public_id,
        fileUrl: result.secure_url,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
      });

      return {
        id: fileUpload.id.toString(),
        publicId: fileUpload.publicId,
        fileUrl: fileUpload.fileUrl,
        fileName: fileUpload.fileName,
        fileType: fileUpload.fileType,
        fileSize: fileUpload.fileSize,
        createdAt: fileUpload.createdAt,
        updatedAt: fileUpload.updatedAt,
      };
    } catch (error) {
      // Clean up temporary file in case of error
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(`Upload failed: ${error.message}`);
    }
  }

  async uploadFile(file: any): Promise<UploadResponseDto> {
    try {
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'gn-farm',
        resource_type: 'auto',
      });

      // Clean up temporary file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      // Save to database via file-tracking service
      const fileUpload = await this.fileTrackingService.create({
        publicId: result.public_id,
        fileUrl: result.secure_url,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
      });

      return {
        id: fileUpload.id.toString(),
        publicId: fileUpload.publicId,
        fileUrl: fileUpload.fileUrl,
        fileName: fileUpload.fileName,
        fileType: fileUpload.fileType,
        fileSize: fileUpload.fileSize,
        createdAt: fileUpload.createdAt,
        updatedAt: fileUpload.updatedAt,
      };
    } catch (error) {
      // Clean up temporary file in case of error
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(`Upload failed: ${error.message}`);
    }
  }

  async deleteFile(publicId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Thử xóa với resource_type 'raw' trước (cho file text/document)
      let result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw'
      });
      
      // Nếu không thành công, thử với resource_type 'image'
      if (result.result !== 'ok') {
        result = await cloudinary.uploader.destroy(publicId, {
          resource_type: 'image'
        });
      }
      
      // Nếu vẫn không thành công, thử với resource_type 'video'
      if (result.result !== 'ok') {
        result = await cloudinary.uploader.destroy(publicId, {
          resource_type: 'video'
        });
      }
      
      if (result.result !== 'ok') {
        throw new BadRequestException(`Failed to delete file from Cloudinary: ${result.result}`);
      }

      // Delete from database
      const fileToDelete = await this.fileTrackingService.findByPublicId(publicId);
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
      
      throw new InternalServerErrorException(`Delete failed: ${error.message}`);
    }
  }

  async markFileAsUsed(publicId: string): Promise<{ success: boolean; message: string }> {
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
      throw new InternalServerErrorException(`Mark as used failed: ${error.message}`);
    }
  }

  async cleanupUnusedFiles(): Promise<{ success: boolean; deletedCount: number }> {
    try {
      // Get orphaned files (files with reference count 0 and created more than 24 hours ago)
      const orphanedFiles = await this.fileTrackingService.findOrphanedFiles();
      
      let deletedCount = 0;
      
      for (const file of orphanedFiles) {
        try {
          // Delete from Cloudinary
          await cloudinary.uploader.destroy(file.publicId);
          
          // Delete from database
          await this.fileTrackingService.remove(file.id);
          
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete orphaned file ${file.publicId}:`, error);
        }
      }
      
      return {
        success: true,
        deletedCount,
      };
    } catch (error) {
      throw new InternalServerErrorException(`Cleanup failed: ${error.message}`);
    }
  }

  private extractPublicIdFromUrl(url: string): string {
    // Extract public_id from Cloudinary URL
    // Example: https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg
    // Public ID: sample
    const matches = url.match(/\/v\d+\/(.+)\.[^.]+$/);
    return matches ? matches[1] : '';
  }
}