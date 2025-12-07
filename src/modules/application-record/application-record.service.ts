import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationRecord } from '../../entities/application-record.entity';
import { CreateApplicationRecordDto, UpdateApplicationRecordDto } from './application-record.dto';

@Injectable()
export class ApplicationRecordService {
  private readonly logger = new Logger(ApplicationRecordService.name);

  constructor(
    @InjectRepository(ApplicationRecord)
    private recordRepository: Repository<ApplicationRecord>,
  ) {}

  async create(createDto: CreateApplicationRecordDto): Promise<ApplicationRecord> {
    this.logger.log(`Tạo nhật ký canh tác mới cho vụ lúa ${createDto.rice_crop_id}`);
    const record = this.recordRepository.create(createDto);
    return this.recordRepository.save(record);
  }

  async findByCrop(cropId: number): Promise<ApplicationRecord[]> {
    return this.recordRepository.find({
      where: { rice_crop_id: cropId },
      relations: ['rice_crop'],
      order: { application_date: 'DESC' },
    });
  }

  async findOne(id: number): Promise<ApplicationRecord> {
    const record = await this.recordRepository.findOne({
      where: { id },
      relations: ['rice_crop'],
    });
    if (!record) {
      throw new NotFoundException(`Không tìm thấy nhật ký với ID: ${id}`);
    }
    return record;
  }

  async update(id: number, updateDto: UpdateApplicationRecordDto): Promise<ApplicationRecord> {
    const record = await this.findOne(id);
    Object.assign(record, updateDto);
    return this.recordRepository.save(record);
  }

  async remove(id: number): Promise<void> {
    const record = await this.findOne(id);
    await this.recordRepository.remove(record);
  }
}
