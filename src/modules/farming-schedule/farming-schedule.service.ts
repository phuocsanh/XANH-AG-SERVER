import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { FarmingSchedule, ScheduleStatus } from '../../entities/farming-schedule.entity';
import { CreateFarmingScheduleDto, UpdateFarmingScheduleDto } from './farming-schedule.dto';

@Injectable()
export class FarmingScheduleService {
  private readonly logger = new Logger(FarmingScheduleService.name);

  constructor(
    @InjectRepository(FarmingSchedule)
    private scheduleRepository: Repository<FarmingSchedule>,
  ) {}

  async create(createDto: CreateFarmingScheduleDto): Promise<FarmingSchedule> {
    this.logger.log(`Tạo lịch canh tác mới cho vụ lúa ${createDto.rice_crop_id}`);
    const schedule = this.scheduleRepository.create(createDto);
    return this.scheduleRepository.save(schedule);
  }

  async findByCrop(cropId: number): Promise<FarmingSchedule[]> {
    return this.scheduleRepository.find({
      where: { rice_crop_id: cropId },
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
      order: { scheduled_date: 'ASC' },
    });
  }

  async findOne(id: number): Promise<FarmingSchedule> {
    const schedule = await this.scheduleRepository.findOne({ where: { id } });
    if (!schedule) {
      throw new NotFoundException(`Không tìm thấy lịch với ID: ${id}`);
    }
    return schedule;
  }

  async update(id: number, updateDto: UpdateFarmingScheduleDto): Promise<FarmingSchedule> {
    const schedule = await this.findOne(id);
    Object.assign(schedule, updateDto);
    return this.scheduleRepository.save(schedule);
  }

  async markAsCompleted(id: number): Promise<FarmingSchedule> {
    return this.update(id, { status: ScheduleStatus.COMPLETED });
  }

  async remove(id: number): Promise<void> {
    const schedule = await this.findOne(id);
    await this.scheduleRepository.remove(schedule);
  }
}
