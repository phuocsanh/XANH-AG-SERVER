import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CostItemCategory } from '../../entities/cost-item-category.entity';
import { CreateCostItemCategoryDto } from './dto/create-cost-item-category.dto';
import { UpdateCostItemCategoryDto } from './dto/update-cost-item-category.dto';
import { SearchCostItemCategoryDto } from './dto/search-cost-item-category.dto';
import { QueryHelper } from '../../common/helpers/query-helper';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';

/**
 * Service xử lý logic nghiệp vụ cho Cost Item Category
 */
@Injectable()
export class CostItemCategoryService {
  constructor(
    @InjectRepository(CostItemCategory)
    private categoryRepository: Repository<CostItemCategory>,
  ) {}

  /**
   * Tạo loại chi phí mới
   */
  async create(createDto: CreateCostItemCategoryDto): Promise<CostItemCategory> {
    // Auto-generate code nếu không được cung cấp
    if (!createDto.code) {
      createDto.code = CodeGeneratorHelper.generateCode('CIC');
    }

    const category = this.categoryRepository.create(createDto);
    return this.categoryRepository.save(category);
  }

  /**
   * Tìm kiếm với phân trang
   */
  async search(searchDto: SearchCostItemCategoryDto): Promise<{
    data: CostItemCategory[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.categoryRepository.createQueryBuilder('category');

    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'category',
      ['code', 'name', 'description'],
    );

    if (searchDto.is_active !== undefined) {
      queryBuilder.andWhere('category.is_active = :is_active', {
        is_active: searchDto.is_active,
      });
    } else {
      // Mặc định chỉ lấy các loại đang hoạt động
      queryBuilder.andWhere('category.is_active = :is_active', {
        is_active: true,
      });
    }

    if (searchDto.code) {
      queryBuilder.andWhere('category.code ILIKE :code', {
        code: `%${searchDto.code}%`,
      });
    }

    if (searchDto.name) {
      queryBuilder.andWhere('category.name ILIKE :name', {
        name: `%${searchDto.name}%`,
      });
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * Tìm theo ID
   */
  async findOne(id: number): Promise<CostItemCategory> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    
    if (!category) {
      throw new NotFoundException(`Không tìm thấy loại chi phí với ID ${id}`);
    }

    return category;
  }

  /**
   * Cập nhật
   */
  async update(
    id: number,
    updateDto: UpdateCostItemCategoryDto,
  ): Promise<CostItemCategory> {
    const category = await this.findOne(id);

    if (updateDto.code && updateDto.code !== category.code) {
      const existing = await this.categoryRepository.findOne({
        where: { code: updateDto.code },
      });

      if (existing) {
        throw new ConflictException(`Mã loại chi phí "${updateDto.code}" đã tồn tại`);
      }
    }

    Object.assign(category, updateDto);
    return this.categoryRepository.save(category);
  }

  /**
   * Xóa (soft delete)
   */
  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);
    category.is_active = false;
    await this.categoryRepository.save(category);
  }

  /**
   * Tìm theo code (dùng cho migration)
   */
  async findByCode(code: string): Promise<CostItemCategory | null> {
    return this.categoryRepository.findOne({ where: { code } });
  }
}
