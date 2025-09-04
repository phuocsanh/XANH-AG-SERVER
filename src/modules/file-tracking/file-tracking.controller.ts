import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { FileTrackingService } from './file-tracking.service';
import { CreateFileUploadDto } from './dto/create-file-upload.dto';

/**
 * Controller xử lý các request liên quan đến quản lý file tracking
 * Bao gồm quản lý file upload và các chức năng liên quan
 */
@Controller('file-tracking')
export class FileTrackingController {
  /**
   * Constructor injection FileTrackingService
   * @param fileTrackingService - Service xử lý logic nghiệp vụ file tracking
   */
  constructor(private readonly fileTrackingService: FileTrackingService) {}

  /**
   * Tạo file upload mới
   * @param createFileUploadDto - Dữ liệu tạo file upload mới
   * @returns Thông tin file upload đã tạo
   */
  @Post()
  create(@Body() createFileUploadDto: CreateFileUploadDto) {
    return this.fileTrackingService.create(createFileUploadDto);
  }

  /**
   * Lấy danh sách tất cả file upload
   * @returns Danh sách file upload
   */
  @Get()
  findAll() {
    return this.fileTrackingService.findAll();
  }

  /**
   * Tìm file upload theo ID
   * @param id - ID của file upload cần tìm
   * @returns Thông tin file upload
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fileTrackingService.findOne(+id);
  }

  /**
   * Tìm file upload theo public ID
   * @param publicId - Public ID của file upload cần tìm
   * @returns Thông tin file upload
   */
  @Get('public/:publicId')
  findByPublicId(@Param('publicId') publicId: string) {
    return this.fileTrackingService.findByPublicId(publicId);
  }

  /**
   * Cập nhật thông tin file upload
   * @param id - ID của file upload cần cập nhật
   * @param updateData - Dữ liệu cập nhật file upload
   * @returns Thông tin file upload đã cập nhật
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateFileUploadDto>,
  ) {
    return this.fileTrackingService.update(+id, updateData);
  }

  /**
   * Xóa file upload theo ID
   * @param id - ID của file upload cần xóa
   * @returns Kết quả xóa file upload
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fileTrackingService.remove(+id);
  }

  /**
   * Tìm các file không được sử dụng (orphaned)
   * @returns Danh sách file không được sử dụng
   */
  @Get('orphaned')
  findOrphanedFiles() {
    return this.fileTrackingService.findOrphanedFiles();
  }

  /**
   * Đánh dấu file để xóa
   * @param id - ID của file cần đánh dấu
   * @returns Thông tin file đã đánh dấu
   */
  @Patch(':id/mark-for-deletion')
  markForDeletion(@Param('id') id: string) {
    return this.fileTrackingService.markForDeletion(+id);
  }

  /**
   * Tìm các file đã được đánh dấu để xóa
   * @returns Danh sách file đã đánh dấu để xóa
   */
  @Get('marked-for-deletion')
  findFilesMarkedForDeletion() {
    return this.fileTrackingService.findFilesMarkedForDeletion();
  }
}
