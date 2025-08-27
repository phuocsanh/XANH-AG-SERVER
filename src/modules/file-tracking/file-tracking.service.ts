import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileUpload } from '../../entities/file-upload.entity';
import { CreateFileUploadDto } from './dto/create-file-upload.dto';

/**
 * Service xử lý logic nghiệp vụ liên quan đến quản lý file tracking
 * Bao gồm quản lý file upload và các chức năng liên quan
 */
@Injectable()
export class FileTrackingService {
  /**
   * Constructor injection repository cần thiết
   * @param fileUploadRepository - Repository để thao tác với entity FileUpload
   */
  constructor(
    @InjectRepository(FileUpload)
    private fileUploadRepository: Repository<FileUpload>,
  ) {}

  /**
   * Tạo file upload mới
   * @param createFileUploadDto - Dữ liệu tạo file upload mới
   * @returns Thông tin file upload đã tạo
   */
  async create(createFileUploadDto: CreateFileUploadDto): Promise<FileUpload> {
    const fileUpload = this.fileUploadRepository.create(createFileUploadDto);
    return this.fileUploadRepository.save(fileUpload);
  }

  /**
   * Lấy danh sách tất cả file upload
   * @returns Danh sách file upload
   */
  async findAll(): Promise<FileUpload[]> {
    return this.fileUploadRepository.find();
  }

  /**
   * Tìm file upload theo ID
   * @param id - ID của file upload cần tìm
   * @returns Thông tin file upload
   */
  async findOne(id: number): Promise<FileUpload> {
    return this.fileUploadRepository.findOne({ where: { id } });
  }

  /**
   * Tìm file upload theo public ID
   * @param publicId - Public ID của file upload cần tìm
   * @returns Thông tin file upload
   */
  async findByPublicId(publicId: string): Promise<FileUpload> {
    return this.fileUploadRepository.findOne({ where: { publicId } });
  }

  /**
   * Cập nhật thông tin file upload
   * @param id - ID của file upload cần cập nhật
   * @param updateData - Dữ liệu cập nhật file upload
   * @returns Thông tin file upload đã cập nhật
   */
  async update(
    id: number,
    updateData: Partial<FileUpload>,
  ): Promise<FileUpload> {
    await this.fileUploadRepository.update(id, updateData);
    return this.findOne(id);
  }

  /**
   * Xóa file upload theo ID
   * @param id - ID của file upload cần xóa
   */
  async remove(id: number): Promise<void> {
    await this.fileUploadRepository.delete(id);
  }

  /**
   * Tăng số lượng tham chiếu của file
   * @param id - ID của file cần tăng tham chiếu
   * @returns Thông tin file đã cập nhật
   */
  async incrementReferenceCount(id: number): Promise<FileUpload> {
    const file = await this.findOne(id);
    if (file) {
      file.referenceCount = (file.referenceCount || 0) + 1;
      return this.fileUploadRepository.save(file);
    }
    return null;
  }

  /**
   * Giảm số lượng tham chiếu của file
   * @param id - ID của file cần giảm tham chiếu
   * @returns Thông tin file đã cập nhật
   */
  async decrementReferenceCount(id: number): Promise<FileUpload> {
    const file = await this.findOne(id);
    if (file && file.referenceCount > 0) {
      file.referenceCount = (file.referenceCount || 0) - 1;
      return this.fileUploadRepository.save(file);
    }
    return null;
  }

  /**
   * Đánh dấu file là không được sử dụng (orphaned)
   * @param id - ID của file cần đánh dấu
   * @returns Thông tin file đã đánh dấu
   */
  async markAsOrphaned(id: number): Promise<FileUpload> {
    return this.update(id, { isOrphaned: true });
  }

  /**
   * Tìm các file không được sử dụng (orphaned)
   * @returns Danh sách file không được sử dụng
   */
  async findOrphanedFiles(): Promise<FileUpload[]> {
    return this.fileUploadRepository.find({
      where: {
        isOrphaned: true,
        deletedAt: null,
      },
    });
  }

  /**
   * Đánh dấu file để xóa
   * @param id - ID của file cần đánh dấu
   * @returns Thông tin file đã đánh dấu
   */
  async markForDeletion(id: number): Promise<FileUpload> {
    return this.update(id, {
      markedForDeletionAt: new Date(), // Ghi nhận thời gian đánh dấu
      isOrphaned: true, // Đánh dấu là không được sử dụng
    });
  }

  /**
   * Tìm các file đã được đánh dấu để xóa
   * @returns Danh sách file đã đánh dấu để xóa
   */
  async findFilesMarkedForDeletion(): Promise<FileUpload[]> {
    return this.fileUploadRepository
      .createQueryBuilder('file')
      .where('file.markedForDeletionAt IS NOT NULL') // File đã được đánh dấu để xóa
      .andWhere('file.deletedAt IS NULL') // File chưa bị xóa
      .getMany();
  }

  /**
   * Xóa mềm file upload
   * @param id - ID của file cần xóa mềm
   */
  async softDelete(id: number): Promise<void> {
    await this.fileUploadRepository.update(id, {
      deletedAt: new Date(), // Ghi nhận thời gian xóa
    });
  }
}
