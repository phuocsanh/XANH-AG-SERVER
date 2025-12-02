import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiceCrop, CropStatus, GrowthStage } from '../../entities/rice-crop.entity';
import { 
  CreateRiceCropDto, 
  UpdateRiceCropDto, 
  UpdateGrowthStageDto, 
  UpdateCropStatusDto,
  QueryRiceCropDto 
} from './rice-crop.dto';

@Injectable()
export class RiceCropService {
  private readonly logger = new Logger(RiceCropService.name);

  constructor(
    @InjectRepository(RiceCrop)
    private riceCropRepository: Repository<RiceCrop>,
  ) {}

  /**
   * Tạo vụ lúa mới
   */
  async create(createDto: CreateRiceCropDto): Promise<RiceCrop> {
    try {
      this.logger.log(`Tạo vụ lúa mới cho khách hàng ${createDto.customer_id}`);
      
      const riceCrop = this.riceCropRepository.create({
        ...createDto,
        growth_stage: GrowthStage.SEEDLING,
        status: CropStatus.ACTIVE,
      });

      const saved = await this.riceCropRepository.save(riceCrop);
      this.logger.log(`✅ Đã tạo vụ lúa ID: ${saved.id}`);
      
      return saved;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi tạo vụ lúa: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể tạo vụ lúa: ${err.message}`);
    }
  }

  /**
   * Lấy danh sách vụ lúa với filter
   */
  async findAll(query: QueryRiceCropDto): Promise<RiceCrop[]> {
    try {
      const queryBuilder = this.riceCropRepository
        .createQueryBuilder('rice_crop')
        .leftJoinAndSelect('rice_crop.customer', 'customer')
        .leftJoinAndSelect('rice_crop.season', 'season')
        .orderBy('rice_crop.created_at', 'DESC');

      // Filter theo customer_id
      if (query.customer_id) {
        queryBuilder.andWhere('rice_crop.customer_id = :customer_id', { 
          customer_id: query.customer_id 
        });
      }

      // Filter theo season_id
      if (query.season_id) {
        queryBuilder.andWhere('rice_crop.season_id = :season_id', { 
          season_id: query.season_id 
        });
      }

      // Filter theo status
      if (query.status) {
        queryBuilder.andWhere('rice_crop.status = :status', { 
          status: query.status 
        });
      }

      // Filter theo growth_stage
      if (query.growth_stage) {
        queryBuilder.andWhere('rice_crop.growth_stage = :growth_stage', { 
          growth_stage: query.growth_stage 
        });
      }

      const crops = await queryBuilder.getMany();
      this.logger.log(`📋 Tìm thấy ${crops.length} vụ lúa`);
      
      return crops;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi lấy danh sách vụ lúa: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể lấy danh sách vụ lúa: ${err.message}`);
    }
  }

  /**
   * Lấy chi tiết vụ lúa theo ID
   */
  async findOne(id: number): Promise<RiceCrop> {
    try {
      const crop = await this.riceCropRepository.findOne({
        where: { id },
        relations: ['customer', 'season'],
      });

      if (!crop) {
        throw new NotFoundException(`Không tìm thấy vụ lúa với ID: ${id}`);
      }

      return crop;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`❌ Lỗi lấy thông tin vụ lúa: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể lấy thông tin vụ lúa: ${err.message}`);
    }
  }

  /**
   * Cập nhật thông tin vụ lúa
   */
  async update(id: number, updateDto: UpdateRiceCropDto): Promise<RiceCrop> {
    try {
      const crop = await this.findOne(id);

      // Cập nhật các trường
      Object.assign(crop, updateDto);

      const updated = await this.riceCropRepository.save(crop);
      this.logger.log(`✅ Đã cập nhật vụ lúa ID: ${id}`);
      
      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`❌ Lỗi cập nhật vụ lúa: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể cập nhật vụ lúa: ${err.message}`);
    }
  }

  /**
   * Cập nhật giai đoạn sinh trưởng
   */
  async updateGrowthStage(id: number, dto: UpdateGrowthStageDto): Promise<RiceCrop> {
    try {
      const crop = await this.findOne(id);

      crop.growth_stage = dto.growth_stage;
      if (dto.notes) {
        crop.notes = dto.notes;
      }

      // Nếu chuyển sang giai đoạn HARVESTED, tự động cập nhật status
      if (dto.growth_stage === GrowthStage.HARVESTED && crop.status === CropStatus.ACTIVE) {
        crop.status = CropStatus.HARVESTED;
        if (!crop.actual_harvest_date) {
          crop.actual_harvest_date = new Date();
        }
      }

      const updated = await this.riceCropRepository.save(crop);
      this.logger.log(`✅ Đã cập nhật giai đoạn sinh trưởng vụ lúa ID: ${id} → ${dto.growth_stage}`);
      
      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`❌ Lỗi cập nhật giai đoạn sinh trưởng: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể cập nhật giai đoạn sinh trưởng: ${err.message}`);
    }
  }

  /**
   * Cập nhật trạng thái vụ lúa
   */
  async updateStatus(id: number, dto: UpdateCropStatusDto): Promise<RiceCrop> {
    try {
      const crop = await this.findOne(id);

      crop.status = dto.status;
      if (dto.notes) {
        crop.notes = dto.notes;
      }

      // Nếu chuyển sang HARVESTED, tự động cập nhật ngày thu hoạch
      if (dto.status === CropStatus.HARVESTED && !crop.actual_harvest_date) {
        crop.actual_harvest_date = new Date();
        crop.growth_stage = GrowthStage.HARVESTED;
      }

      const updated = await this.riceCropRepository.save(crop);
      this.logger.log(`✅ Đã cập nhật trạng thái vụ lúa ID: ${id} → ${dto.status}`);
      
      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`❌ Lỗi cập nhật trạng thái: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể cập nhật trạng thái: ${err.message}`);
    }
  }

  /**
   * Xóa vụ lúa
   */
  async remove(id: number): Promise<void> {
    try {
      const crop = await this.findOne(id);
      await this.riceCropRepository.remove(crop);
      this.logger.log(`✅ Đã xóa vụ lúa ID: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`❌ Lỗi xóa vụ lúa: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể xóa vụ lúa: ${err.message}`);
    }
  }

  /**
   * Lấy thống kê vụ lúa theo khách hàng
   */
  async getCustomerStats(customerId: number): Promise<{
    total: number;
    active: number;
    harvested: number;
    failed: number;
    totalArea: number;
    totalYield: number;
  }> {
    try {
      const crops = await this.riceCropRepository.find({
        where: { customer_id: customerId },
      });

      const stats = {
        total: crops.length,
        active: crops.filter(c => c.status === CropStatus.ACTIVE).length,
        harvested: crops.filter(c => c.status === CropStatus.HARVESTED).length,
        failed: crops.filter(c => c.status === CropStatus.FAILED).length,
        totalArea: crops.reduce((sum, c) => sum + Number(c.field_area), 0),
        totalYield: crops.reduce((sum, c) => sum + (Number(c.yield_amount) || 0), 0),
      };

      return stats;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi lấy thống kê: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể lấy thống kê: ${err.message}`);
    }
  }
}
