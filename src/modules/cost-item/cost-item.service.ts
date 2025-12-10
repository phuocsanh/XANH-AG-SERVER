import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CostItem, CostCategory } from '../../entities/cost-item.entity';
import { CreateCostItemDto, UpdateCostItemDto, QueryCostItemDto } from './cost-item.dto';

@Injectable()
export class CostItemService {
  private readonly logger = new Logger(CostItemService.name);

  constructor(
    @InjectRepository(CostItem)
    private costItemRepository: Repository<CostItem>,
  ) {}

  async create(createDto: CreateCostItemDto): Promise<CostItem> {
    try {
      this.logger.log(`Tạo chi phí mới cho mảnh ruộng ${createDto.rice_crop_id}`);
      
      const costItem = this.costItemRepository.create(createDto);
      const saved = await this.costItemRepository.save(costItem);
      
      this.logger.log(`✅ Đã tạo chi phí ID: ${saved.id}`);
      return saved;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi tạo chi phí: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể tạo chi phí: ${err.message}`);
    }
  }

  async findAll(query: QueryCostItemDto): Promise<CostItem[]> {
    try {
      const queryBuilder = this.costItemRepository
        .createQueryBuilder('cost_item')
        .leftJoinAndSelect('cost_item.rice_crop', 'rice_crop')
        .orderBy('cost_item.created_at', 'DESC');

      if (query.rice_crop_id) {
        queryBuilder.andWhere('cost_item.rice_crop_id = :rice_crop_id', { 
          rice_crop_id: query.rice_crop_id 
        });
      }

      if (query.category) {
        queryBuilder.andWhere('cost_item.category = :category', { 
          category: query.category 
        });
      }

      const items = await queryBuilder.getMany();
      this.logger.log(`📋 Tìm thấy ${items.length} chi phí`);
      
      return items;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi lấy danh sách chi phí: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể lấy danh sách chi phí: ${err.message}`);
    }
  }

  async findOne(id: number): Promise<CostItem> {
    try {
      const item = await this.costItemRepository.findOne({
        where: { id },
        relations: ['rice_crop'],
      });

      if (!item) {
        throw new NotFoundException(`Không tìm thấy chi phí với ID: ${id}`);
      }

      return item;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`❌ Lỗi lấy thông tin chi phí: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể lấy thông tin chi phí: ${err.message}`);
    }
  }

  async update(id: number, updateDto: UpdateCostItemDto): Promise<CostItem> {
    try {
      const item = await this.findOne(id);
      Object.assign(item, updateDto);
      
      const updated = await this.costItemRepository.save(item);
      this.logger.log(`✅ Đã cập nhật chi phí ID: ${id}`);
      
      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`❌ Lỗi cập nhật chi phí: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể cập nhật chi phí: ${err.message}`);
    }
  }

  async remove(id: number): Promise<void> {
    try {
      const item = await this.findOne(id);
      await this.costItemRepository.remove(item);
      this.logger.log(`✅ Đã xóa chi phí ID: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`❌ Lỗi xóa chi phí: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể xóa chi phí: ${err.message}`);
    }
  }

  async getSummaryByCrop(cropId: number): Promise<{
    total: number;
    breakdown: Record<CostCategory, number>;
    items: CostItem[];
  }> {
    try {
      const items = await this.costItemRepository.find({
        where: { rice_crop_id: cropId },
      });

      const total = items.reduce((sum, item) => sum + Number(item.total_cost), 0);
      
      const breakdown: Record<CostCategory, number> = {
        [CostCategory.SEED]: 0,
        [CostCategory.FERTILIZER]: 0,
        [CostCategory.PESTICIDE]: 0,
        [CostCategory.LABOR]: 0,
        [CostCategory.MACHINERY]: 0,
        [CostCategory.IRRIGATION]: 0,
        [CostCategory.OTHER]: 0,
      };

      items.forEach(item => {
        const category = item.category || CostCategory.OTHER; // Fallback nếu category undefined
        breakdown[category] += Number(item.total_cost);
      });

      return { total, breakdown, items };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi lấy tổng hợp chi phí: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể lấy tổng hợp chi phí: ${err.message}`);
    }
  }
  async search(searchDto: any): Promise<{ data: CostItem[]; total: number }> {
    try {
      const { page = 1, limit = 20, ...query } = searchDto;
      const skip = (page - 1) * limit;

      const queryBuilder = this.costItemRepository
        .createQueryBuilder('cost_item')
        .leftJoinAndSelect('cost_item.rice_crop', 'rice_crop')
        .orderBy('cost_item.created_at', 'DESC');

      if (query.rice_crop_id) {
        queryBuilder.andWhere('cost_item.rice_crop_id = :rice_crop_id', { 
          rice_crop_id: query.rice_crop_id 
        });
      }

      if (query.category) {
        queryBuilder.andWhere('cost_item.category = :category', { 
          category: query.category 
        });
      }

      queryBuilder.skip(skip).take(limit);

      const [data, total] = await queryBuilder.getManyAndCount();
      this.logger.log(`📋 Tìm thấy ${data.length} chi phí`);
      
      return { data, total };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`❌ Lỗi tìm kiếm chi phí: ${err.message}`, err.stack);
      throw new BadRequestException(`Không thể tìm kiếm chi phí: ${err.message}`);
    }
  }
}
