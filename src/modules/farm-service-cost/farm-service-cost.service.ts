import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { FarmServiceCost } from '../../entities/farm-service-cost.entity';
import { CreateFarmServiceCostDto } from './dto/create-farm-service-cost.dto';
import { UpdateFarmServiceCostDto } from './dto/update-farm-service-cost.dto';
import { SearchFarmServiceCostDto } from './dto/search-farm-service-cost.dto';

/**
 * Service xử lý logic cho chi phí dịch vụ nông nghiệp dành cho nông dân
 */
@Injectable()
export class FarmServiceCostService {
  private readonly logger = new Logger(FarmServiceCostService.name);

  constructor(
    @InjectRepository(FarmServiceCost)
    private farmServiceCostRepository: Repository<FarmServiceCost>,
  ) {}

  /**
   * Tạo chi phí dịch vụ mới
   */
  async create(createDto: CreateFarmServiceCostDto, manager?: any): Promise<FarmServiceCost> {
    try {
      const repo = manager ? manager.getRepository(FarmServiceCost) : this.farmServiceCostRepository;
      const farmServiceCost = repo.create(createDto);
      const saved = await repo.save(farmServiceCost);
      
      this.logger.log(`✅ Đã tạo chi phí dịch vụ: ${saved.name} - ${saved.amount}đ`);
      return saved;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi tạo chi phí dịch vụ: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Tìm kiếm chi phí dịch vụ với filter
   */
  async search(searchDto: SearchFarmServiceCostDto): Promise<{ data: FarmServiceCost[]; total: number }> {
    try {
      const queryBuilder = this.farmServiceCostRepository
        .createQueryBuilder('farm_service_cost')
        .leftJoinAndSelect('farm_service_cost.season', 'season')
        .leftJoinAndSelect('farm_service_cost.customer', 'customer')
        .leftJoinAndSelect('farm_service_cost.rice_crop', 'rice_crop');

      // Apply filters
      const where: any = {};
      
      if (searchDto.season_id) {
        where.season_id = searchDto.season_id;
      }
      
      if (searchDto.customer_id) {
        where.customer_id = searchDto.customer_id;
      }
      
      if (searchDto.rice_crop_id) {
        where.rice_crop_id = searchDto.rice_crop_id;
      }
      
      if (searchDto.source) {
        where.source = searchDto.source;
      }

      // Date range filter
      if (searchDto.start_date && searchDto.end_date) {
        where.expense_date = Between(new Date(searchDto.start_date), new Date(searchDto.end_date));
      }

      queryBuilder.where(where);

      // Keyword search
      if (searchDto.keyword) {
        queryBuilder.andWhere('farm_service_cost.name LIKE :keyword OR farm_service_cost.notes LIKE :keyword', {
          keyword: `%${searchDto.keyword}%`,
        });
      }

      // Sorting - Mặc định sắp xếp theo ngày tạo mới nhất
      const sortBy = searchDto.sort_by || 'created_at';
      const sortOrder = searchDto.sort_order || 'DESC';
      queryBuilder.orderBy(`farm_service_cost.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      // Pagination
      const page = searchDto.page || 1;
      const limit = searchDto.limit || 20;
      const skip = (page - 1) * limit;

      queryBuilder.skip(skip).take(limit);

      const [data, total] = await queryBuilder.getManyAndCount();

      this.logger.log(`🔍 Tìm thấy ${data.length}/${total} chi phí dịch vụ`);
      
      return { data, total };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi tìm kiếm chi phí dịch vụ: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * Lấy chi phí dịch vụ theo ID
   */
  async findOne(id: number): Promise<FarmServiceCost> {
    const farmServiceCost = await this.farmServiceCostRepository.findOne({
      where: { id },
      relations: ['season', 'customer', 'rice_crop'],
    });

    if (!farmServiceCost) {
      throw new NotFoundException(`Không tìm thấy chi phí dịch vụ với ID: ${id}`);
    }

    return farmServiceCost;
  }

  /**
   * Cập nhật chi phí dịch vụ
   */
  async update(id: number, updateDto: UpdateFarmServiceCostDto): Promise<FarmServiceCost> {
    const farmServiceCost = await this.findOne(id);
    
    Object.assign(farmServiceCost, updateDto);
    const updated = await this.farmServiceCostRepository.save(farmServiceCost);
    
    this.logger.log(`✅ Đã cập nhật chi phí dịch vụ #${id}`);
    return updated;
  }

  /**
   * Xóa chi phí dịch vụ
   */
  async remove(id: number): Promise<void> {
    const farmServiceCost = await this.findOne(id);
    await this.farmServiceCostRepository.remove(farmServiceCost);
    
    this.logger.log(`✅ Đã xóa chi phí dịch vụ #${id}`);
  }
}
