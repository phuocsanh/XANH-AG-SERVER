import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { FarmingSchedule, ScheduleStatus, ActivityType } from '../../entities/farming-schedule.entity';
import { CreateFarmingScheduleDto, UpdateFarmingScheduleDto } from './farming-schedule.dto';

@Injectable()
export class FarmingScheduleService {
  private readonly logger = new Logger(FarmingScheduleService.name);

  constructor(
    @InjectRepository(FarmingSchedule)
    private scheduleRepository: Repository<FarmingSchedule>,
  ) {}

  async create(createDto: CreateFarmingScheduleDto): Promise<FarmingSchedule> {
    this.logger.log(`Tạo lịch canh tác mới cho mảnh ruộng ${createDto.rice_crop_id}`);
    
    // Nếu không có activity_type, mặc định là OTHER
    if (!createDto.activity_type) {
      createDto.activity_type = ActivityType.OTHER;
    }
    
    const schedule = this.scheduleRepository.create(createDto);
    return this.scheduleRepository.save(schedule);
  }

  async findByCrop(cropId: number): Promise<FarmingSchedule[]> {
    return this.scheduleRepository.find({
      where: { rice_crop_id: cropId },
      relations: ['rice_crop'],
      order: { scheduled_date: 'ASC' },
    });
  }

  async findUpcoming(days: number = 7): Promise<FarmingSchedule[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    return this.scheduleRepository.find({
      where: {
        scheduled_date: LessThanOrEqual(futureDate),
        status: ScheduleStatus.PENDING,
      },
      relations: ['rice_crop'],
      order: { scheduled_date: 'ASC' },
    });
  }

  async findOne(id: number): Promise<FarmingSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id },
      relations: ['rice_crop'],
    });
    if (!schedule) {
      throw new NotFoundException(`Không tìm thấy lịch với ID: ${id}`);
    }
    return schedule;
  }

  async update(id: number, updateDto: UpdateFarmingScheduleDto): Promise<FarmingSchedule> {
    const schedule = await this.findOne(id);
    
    // Nếu có hoàn thành, đảm bảo lưu ngày chuẩn
    if (updateDto.status === ScheduleStatus.COMPLETED && !updateDto.completed_date) {
      (updateDto as any).completed_date = new Date().toISOString().split('T')[0];
    }
    
    Object.assign(schedule, updateDto as any);
    return this.scheduleRepository.save(schedule);
  }

  async markAsCompleted(id: number): Promise<FarmingSchedule> {
    return this.update(id, { 
      status: ScheduleStatus.COMPLETED,
      completed_date: new Date().toISOString().split('T')[0]
    } as UpdateFarmingScheduleDto);
  }

  async remove(id: number): Promise<void> {
    const schedule = await this.findOne(id);
    await this.scheduleRepository.remove(schedule);
  }
}
