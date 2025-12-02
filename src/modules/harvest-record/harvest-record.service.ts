import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HarvestRecord } from '../../entities/harvest-record.entity';
import { CreateHarvestRecordDto, UpdateHarvestRecordDto } from './harvest-record.dto';

@Injectable()
export class HarvestRecordService {
  private readonly logger = new Logger(HarvestRecordService.name);

  constructor(
    @InjectRepository(HarvestRecord)
    private harvestRecordRepository: Repository<HarvestRecord>,
  ) {}

  async create(createDto: CreateHarvestRecordDto): Promise<HarvestRecord> {
    try {
      const record = this.harvestRecordRepository.create(createDto);
      const saved = await this.harvestRecordRepository.save(record);
      this.logger.log(`✅ Đã tạo thu hoạch ID: ${saved.id}`);
      return saved;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi tạo thu hoạch: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể tạo thu hoạch: ${err.message}`);
    }
  }

  async findByCrop(cropId: number): Promise<HarvestRecord[]> {
    return this.harvestRecordRepository.find({
      where: { rice_crop_id: cropId },
      relations: ['rice_crop'],
      order: { harvest_date: 'DESC' },
    });
  }

  async findOne(id: number): Promise<HarvestRecord> {
    const record = await this.harvestRecordRepository.findOne({
      where: { id },
      relations: ['rice_crop'],
    });
    if (!record) {
      throw new NotFoundException(`Không tìm thấy thu hoạch với ID: ${id}`);
    }
    return record;
  }

  async update(id: number, updateDto: UpdateHarvestRecordDto): Promise<HarvestRecord> {
    const record = await this.findOne(id);
    Object.assign(record, updateDto);
    return this.harvestRecordRepository.save(record);
  }

  async remove(id: number): Promise<void> {
    const record = await this.findOne(id);
    await this.harvestRecordRepository.remove(record);
  }
}
