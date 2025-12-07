import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GrowthTracking } from '../../entities/growth-tracking.entity';
import { CreateGrowthTrackingDto, UpdateGrowthTrackingDto } from './growth-tracking.dto';

@Injectable()
export class GrowthTrackingService {
  private readonly logger = new Logger(GrowthTrackingService.name);

  constructor(
    @InjectRepository(GrowthTracking)
    private trackingRepository: Repository<GrowthTracking>,
  ) {}

  async create(createDto: CreateGrowthTrackingDto): Promise<GrowthTracking> {
    this.logger.log(`Tạo theo dõi sinh trưởng mới cho vụ lúa ${createDto.rice_crop_id}`);
    const tracking = this.trackingRepository.create(createDto);
    return this.trackingRepository.save(tracking);
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
    Object.assign(tracking, updateDto);
    return this.trackingRepository.save(tracking);
  }

  async remove(id: number): Promise<void> {
    const tracking = await this.findOne(id);
    await this.trackingRepository.remove(tracking);
  }
}
