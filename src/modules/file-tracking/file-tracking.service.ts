import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileUpload } from '../../entities/file-upload.entity';
import { CreateFileUploadDto } from './dto/create-file-upload.dto';

@Injectable()
export class FileTrackingService {
  constructor(
    @InjectRepository(FileUpload)
    private fileUploadRepository: Repository<FileUpload>,
  ) {}

  async create(createFileUploadDto: CreateFileUploadDto): Promise<FileUpload> {
    const fileUpload = this.fileUploadRepository.create(createFileUploadDto);
    return this.fileUploadRepository.save(fileUpload);
  }

  async findAll(): Promise<FileUpload[]> {
    return this.fileUploadRepository.find();
  }

  async findOne(id: number): Promise<FileUpload> {
    return this.fileUploadRepository.findOne({ where: { id } });
  }

  async findByPublicId(publicId: string): Promise<FileUpload> {
    return this.fileUploadRepository.findOne({ where: { publicId } });
  }

  async update(id: number, updateData: Partial<FileUpload>): Promise<FileUpload> {
    await this.fileUploadRepository.update(id, updateData);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.fileUploadRepository.delete(id);
  }

  async incrementReferenceCount(id: number): Promise<FileUpload> {
    const file = await this.findOne(id);
    if (file) {
      file.referenceCount = (file.referenceCount || 0) + 1;
      return this.fileUploadRepository.save(file);
    }
    return null;
  }

  async decrementReferenceCount(id: number): Promise<FileUpload> {
    const file = await this.findOne(id);
    if (file && file.referenceCount > 0) {
      file.referenceCount = (file.referenceCount || 0) - 1;
      return this.fileUploadRepository.save(file);
    }
    return null;
  }

  async markAsOrphaned(id: number): Promise<FileUpload> {
    return this.update(id, { isOrphaned: true });
  }

  async findOrphanedFiles(): Promise<FileUpload[]> {
    return this.fileUploadRepository.find({ 
      where: { 
        isOrphaned: true,
        deletedAt: null,
      } 
    });
  }

  async markForDeletion(id: number): Promise<FileUpload> {
    return this.update(id, { 
      markedForDeletionAt: new Date(),
      isOrphaned: true,
    });
  }

  async findFilesMarkedForDeletion(): Promise<FileUpload[]> {
    return this.fileUploadRepository
      .createQueryBuilder('file')
      .where('file.markedForDeletionAt IS NOT NULL')
      .andWhere('file.deletedAt IS NULL')
      .getMany();
  }

  async softDelete(id: number): Promise<void> {
    await this.fileUploadRepository.update(id, { 
      deletedAt: new Date() 
    });
  }
}