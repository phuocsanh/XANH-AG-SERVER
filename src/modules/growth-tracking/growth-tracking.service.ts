import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrowthTracking } from '../../entities/growth-tracking.entity';
import { CreateGrowthTrackingDto, UpdateGrowthTrackingDto } from './growth-tracking.dto';
import { FileTrackingService } from '../file-tracking/file-tracking.service';

@Injectable()
export class GrowthTrackingService {
  private readonly logger = new Logger(GrowthTrackingService.name);

  constructor(
    @InjectRepository(GrowthTracking)
    private trackingRepository: Repository<GrowthTracking>,
    private fileTrackingService: FileTrackingService,
  ) {}

  async create(createDto: CreateGrowthTrackingDto): Promise<GrowthTracking> {
    this.logger.log(`Tạo theo dõi sinh trưởng mới cho mảnh ruộng ${createDto.rice_crop_id}`);
    const tracking = this.trackingRepository.create(createDto);
    const savedTracking = await this.trackingRepository.save(tracking);

    // ✅ Đánh dấu ảnh là đã sử dụng
    if (savedTracking && savedTracking.photo_urls && savedTracking.photo_urls.length > 0) {
      await this.markImagesAsUsed(savedTracking.id, savedTracking.photo_urls);
    }

    return savedTracking;
  }

  async findByCrop(cropId: number): Promise<GrowthTracking[]> {
    return this.trackingRepository.find({
      where: { rice_crop_id: cropId },
      relations: ['rice_crop'],
      order: { tracking_date: 'DESC' },
    });
  }

  async findOne(id: number): Promise<GrowthTracking> {
    const tracking = await this.trackingRepository.findOne({
      where: { id },
      relations: ['rice_crop'],
    });
    if (!tracking) {
      throw new NotFoundException(`Không tìm thấy theo dõi với ID: ${id}`);
    }
    return tracking;
  }

  async update(id: number, updateDto: UpdateGrowthTrackingDto): Promise<GrowthTracking> {
    const tracking = await this.findOne(id);
    const oldPhotos = tracking.photo_urls || [];
    
    Object.assign(tracking, updateDto);
    const updatedTracking = await this.trackingRepository.save(tracking);

    // ✅ Cập nhật theo dõi ảnh
    if (updateDto.photo_urls !== undefined) {
      await this.handleImageUpdate(id, oldPhotos, updatedTracking.photo_urls || []);
    }

    return updatedTracking;
  }

  async remove(id: number): Promise<void> {
    const tracking = await this.findOne(id);
    
    // Gỡ các reference trước khi xóa
    if (tracking.photo_urls && tracking.photo_urls.length > 0) {
      for (const url of tracking.photo_urls) {
        await this.fileTrackingService.removeFileReferenceByUrl(url, 'GrowthTracking', id);
      }
    }

    await this.trackingRepository.remove(tracking);
  }

  /**
   * Đánh dấu các hình ảnh là đã sử dụng
   */
  private async markImagesAsUsed(id: number, photos: string[]): Promise<void> {
    for (const url of photos) {
      const file = await this.fileTrackingService.findByFileUrl(url);
      if (file) {
        await this.fileTrackingService.createFileReference(file, 'GrowthTracking', id, 'photo_urls');
        await this.fileTrackingService.incrementReferenceCount(file.id);
      }
    }
  }

  /**
   * Xử lý cập nhật hình ảnh
   */
  private async handleImageUpdate(id: number, oldPhotos: string[], newPhotos: string[]): Promise<void> {
    // 1. Tìm các ảnh bị gỡ
    const removedPhotos = oldPhotos.filter(url => !newPhotos.includes(url));
    for (const url of removedPhotos) {
      await this.fileTrackingService.removeFileReferenceByUrl(url, 'GrowthTracking', id);
    }

    // 2. Tìm các ảnh mới thêm
    const addedPhotos = newPhotos.filter(url => !oldPhotos.includes(url));
    for (const url of addedPhotos) {
      const file = await this.fileTrackingService.findByFileUrl(url);
      if (file) {
        await this.fileTrackingService.createFileReference(file, 'GrowthTracking', id, 'photo_urls');
        await this.fileTrackingService.incrementReferenceCount(file.id);
      }
    }
  }
}
