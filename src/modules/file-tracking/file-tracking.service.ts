import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FileUpload } from '../../entities/file-uploads.entity';
import { FileReference } from '../../entities/file-references.entity';
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
   * @param fileReferenceRepository - Repository để thao tác với entity FileReference
   */
  constructor(
    @InjectRepository(FileUpload)
    private fileUploadRepository: Repository<FileUpload>,
    @InjectRepository(FileReference)
    private fileReferenceRepository: Repository<FileReference>,
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
  async findOne(id: number): Promise<FileUpload | null> {
    return this.fileUploadRepository.findOne({ where: { id } });
  }

  /**
   * Tìm file upload theo public ID
   * @param publicId - Public ID của file upload cần tìm
   * @returns Thông tin file upload
   */
  async findByPublicId(publicId: string): Promise<FileUpload | null> {
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
  ): Promise<FileUpload | null> {
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
  async incrementReferenceCount(id: number): Promise<FileUpload | null> {
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
  async decrementReferenceCount(id: number): Promise<FileUpload | null> {
    const file = await this.findOne(id);
    if (file && (file.referenceCount || 0) > 0) {
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
  async markAsOrphaned(id: number): Promise<FileUpload | null> {
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
        deletedAt: IsNull(),
      },
    });
  }

  /**
   * Đánh dấu file để xóa
   * @param id - ID của file cần đánh dấu
   * @returns Thông tin file đã đánh dấu
   */
  async markForDeletion(id: number): Promise<FileUpload | null> {
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

  /**
   * Tạo tham chiếu file mới
   * @param fileId - ID của file
   * @param entityType - Loại thực thể (ví dụ: 'product', 'user')
   * @param entityId - ID của thực thể
   * @param fieldName - Tên trường chứa file
   * @param arrayIndex - Vị trí trong mảng (nếu có)
   * @param createdByUserId - ID người tạo
   * @returns Tham chiếu file đã tạo
   */
  async createFileReference(
    fileId: number,
    entityType: string,
    entityId: number,
    fieldName?: string,
    arrayIndex?: number,
    createdByUserId?: number,
  ): Promise<FileReference> {
    const fileReference = this.fileReferenceRepository.create({
      fileId,
      entityType,
      entityId,
      ...(fieldName !== undefined && { fieldName }),
      ...(arrayIndex !== undefined && { arrayIndex }),
      ...(createdByUserId !== undefined && { createdByUserId }),
    });
    return this.fileReferenceRepository.save(fileReference);
  }

  /**
   * Tìm tất cả tham chiếu file theo entity
   * @param entityType - Loại thực thể
   * @param entityId - ID của thực thể
   * @returns Danh sách tham chiếu file
   */
  async findFileReferencesByEntity(
    entityType: string,
    entityId: number,
  ): Promise<FileReference[]> {
    return this.fileReferenceRepository.find({
      where: {
        entityType,
        entityId,
        deletedAt: IsNull(), // Chỉ lấy các tham chiếu chưa bị xóa
      },
      relations: ['fileUpload'], // Bao gồm thông tin file
    });
  }

  /**
   * Xóa mềm tham chiếu file
   * @param fileId - ID của file
   * @param entityType - Loại thực thể
   * @param entityId - ID của thực thể
   * @param deletedByUserId - ID người xóa
   */
  async removeFileReference(
    fileId: number,
    entityType: string,
    entityId: number,
    deletedByUserId?: number,
  ): Promise<void> {
    await this.fileReferenceRepository.update(
      {
        fileId,
        entityType,
        entityId,
        deletedAt: IsNull(), // Chỉ cập nhật các tham chiếu chưa bị xóa
      },
      {
        deletedAt: new Date(),
        ...(deletedByUserId !== undefined && { deletedByUserId }),
      },
    );
  }

  /**
   * Xóa hàng loạt tất cả tham chiếu file của một thực thể
   * @param entityType - Loại thực thể
   * @param entityId - ID của thực thể
   * @param deletedByUserId - ID người xóa
   */
  async batchRemoveEntityFileReferences(
    entityType: string,
    entityId: number,
    deletedByUserId?: number,
  ): Promise<void> {
    // Lấy tất cả tham chiếu file của thực thể
    const fileReferences = await this.findFileReferencesByEntity(
      entityType,
      entityId,
    );

    if (fileReferences.length === 0) {
      return; // Không có tham chiếu nào để xóa
    }

    // Xóa mềm tất cả tham chiếu
    await this.fileReferenceRepository.update(
      {
        entityType,
        entityId,
        deletedAt: IsNull(), // Chỉ cập nhật các tham chiếu chưa bị xóa
      },
      {
        deletedAt: new Date(),
        ...(deletedByUserId !== undefined && { deletedByUserId }),
      },
    );

    // Giảm reference count cho từng file
    for (const reference of fileReferences) {
      await this.decrementReferenceCount(reference.fileId);
      
      // Kiểm tra và đánh dấu file là orphaned nếu không còn tham chiếu
      const file = await this.findOne(reference.fileId);
      if (file && (file.referenceCount || 0) <= 0) {
        await this.markAsOrphaned(reference.fileId);
      }
    }
  }

  /**
   * Tìm file theo URL
   * @param fileUrl - URL của file
   * @returns Thông tin file upload
   */
  async findByFileUrl(fileUrl: string): Promise<FileUpload | null> {
    return this.fileUploadRepository.findOne({ where: { fileUrl } });
  }

  /**
   * Xóa tham chiếu file theo URL và thực thể
   * @param fileUrl - URL của file
   * @param entityType - Loại thực thể
   * @param entityId - ID của thực thể
   * @param deletedByUserId - ID người xóa
   */
  async removeFileReferenceByUrl(
    fileUrl: string,
    entityType: string,
    entityId: number,
    deletedByUserId?: number,
  ): Promise<void> {
    // Tìm file theo URL
    const file = await this.findByFileUrl(fileUrl);
    if (!file) {
      return; // File không tồn tại
    }

    // Xóa tham chiếu
    await this.removeFileReference(file.id, entityType, entityId, deletedByUserId);
  }

  /**
   * Xóa hàng loạt tham chiếu file theo danh sách URL
   * @param fileUrls - Danh sách URL file
   * @param entityType - Loại thực thể
   * @param entityId - ID của thực thể
   * @param deletedByUserId - ID người xóa
   */
  async batchRemoveFileReferencesByUrls(
    fileUrls: string[],
    entityType: string,
    entityId: number,
    deletedByUserId?: number,
  ): Promise<void> {
    for (const fileUrl of fileUrls) {
      await this.removeFileReferenceByUrl(
        fileUrl,
        entityType,
        entityId,
        deletedByUserId,
      );
    }
  }
}
