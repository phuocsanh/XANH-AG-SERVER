import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FileUpload } from '../../entities/file-uploads.entity';
import { FileReference } from '../../entities/file-references.entity';
import { CreateFileUploadDto } from './dto/create-file-upload.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';

/**
 * Service xử lý logic nghiệp vụ liên quan đến theo dõi file
 * Bao gồm các thao tác CRUD cho FileUpload và FileReference
 */
@Injectable()
export class FileTrackingService {
  /**
   * Constructor injection các repository cần thiết
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
   * Tạo bản ghi file upload mới
   * @param createFileUploadDto - Dữ liệu tạo file upload mới
   * @returns Thông tin file upload đã tạo
   */
  async create(createFileUploadDto: CreateFileUploadDto): Promise<FileUpload> {
    try {
      const fileUpload = this.fileUploadRepository.create(createFileUploadDto);
      return this.fileUploadRepository.save(fileUpload);
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'file upload');
    }
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
   * Tìm file upload theo publicId
   * @param publicId - Public ID của file cần tìm
   * @returns Thông tin file upload
   */
  async findByPublicId(public_id: string): Promise<FileUpload | null> {
    return this.fileUploadRepository.findOne({ where: { public_id } });
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
    try {
      await this.fileUploadRepository.update(id, updateData);
      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'file upload');
    }
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
      file.reference_count = (file.reference_count || 0) + 1;
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
    if (file && (file.reference_count || 0) > 0) {
      file.reference_count = (file.reference_count || 0) - 1;
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
    return this.update(id, { is_orphaned: true });
  }

  /**
   * Tìm các file không được sử dụng (orphaned)
   * @returns Danh sách file không được sử dụng
   */
  async findOrphanedFiles(): Promise<FileUpload[]> {
    return this.fileUploadRepository.find({
      where: {
        is_orphaned: true,
        deleted_at: IsNull(),
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
      marked_for_deletion_at: new Date(), // Ghi nhận thời gian đánh dấu
      is_orphaned: true, // Đánh dấu là không được sử dụng
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
      .andWhere('file.deleted_at IS NULL') // File chưa bị xóa
      .getMany();
  }

  /**
   * Xóa mềm file upload
   * @param id - ID của file cần xóa mềm
   */
  async softDelete(id: number): Promise<void> {
    await this.fileUploadRepository.update(id, {
      deleted_at: new Date(), // Ghi nhận thời gian xóa
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
    fileUpload: FileUpload,
    entityType: string,
    entityId: number,
    fieldName?: string,
    // arrayIndex?: number,
    // createdByUserId?: number,
  ): Promise<FileReference> {
    if (!fileUpload) {
      throw new Error('File not found');
    }

    const fileReference = this.fileReferenceRepository.create({
      file_id: fileUpload.id,
      entity_type: entityType,
      entity_id: entityId,
      ...(fieldName && { field_name: fieldName }), // Chỉ thêm field_name nếu nó không null/undefined
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
        entity_type: entityType,
        entity_id: entityId,
        deleted_at: IsNull(), // Chỉ lấy các tham chiếu chưa bị xóa
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
        file_id: fileId,
        entity_type: entityType,
        entity_id: entityId,
        deleted_at: IsNull(), // Chỉ cập nhật các tham chiếu chưa bị xóa
      },
      {
        deleted_at: new Date(),
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
        entity_type: entityType,
        entity_id: entityId,
        deleted_at: IsNull(), // Chỉ cập nhật các tham chiếu chưa bị xóa
      },
      {
        deleted_at: new Date(),
        ...(deletedByUserId !== undefined && { deletedByUserId }),
      },
    );

    // Giảm reference count cho từng file
    for (const reference of fileReferences) {
      await this.decrementReferenceCount(reference.file_id);

      // Kiểm tra và đánh dấu file là orphaned nếu không còn tham chiếu
      const file = await this.findOne(reference.file_id);
      if (file && (file.reference_count || 0) <= 0) {
        await this.markAsOrphaned(reference.file_id);
      }
    }
  }

  /**
   * Tìm file theo URL
   * @param fileUrl - URL của file
   * @returns Thông tin file upload
   */
  async findByFileUrl(url: string): Promise<FileUpload | null> {
    return this.fileUploadRepository.findOne({ where: { url } });
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
    await this.removeFileReference(
      file.id,
      entityType,
      entityId,
      deletedByUserId,
    );
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
