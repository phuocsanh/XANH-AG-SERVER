import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperatingCostCategory } from '../../entities/operating-cost-category.entity';
import { CreateOperatingCostCategoryDto } from './dto/create-operating-cost-category.dto';
import { UpdateOperatingCostCategoryDto } from './dto/update-operating-cost-category.dto';
import { SearchOperatingCostCategoryDto } from './dto/search-operating-cost-category.dto';
import { QueryHelper } from '../../common/helpers/query-helper';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';

/**
 * Service xử lý logic nghiệp vụ cho Operating Cost Category
 */
@Injectable()
export class OperatingCostCategoryService {
  constructor(
    @InjectRepository(OperatingCostCategory)
    private categoryRepository: Repository<OperatingCostCategory>,
  ) {}

  /**
   * Tạo loại chi phí mới
   */
  async create(createDto: CreateOperatingCostCategoryDto): Promise<OperatingCostCategory> {
    // Auto-generate code nếu không được cung cấp
    if (!createDto.code) {
      createDto.code = CodeGeneratorHelper.generateCode('OCC');
    }

    const category = this.categoryRepository.create(createDto);
    return this.categoryRepository.save(category);
  }

  /**
   * Lấy tất cả categories (cho dropdown)
   */
  async findAll(): Promise<OperatingCostCategory[]> {
    return this.categoryRepository.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Tìm kiếm nâng cao với phân trang
   */
  async search(searchDto: SearchOperatingCostCategoryDto): Promise<{
    data: OperatingCostCategory[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.categoryRepository.createQueryBuilder('category');

    // Apply base search (pagination, sorting, keyword)
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'category',
      ['code', 'name', 'description'],
    );

    // Apply filters
    if (searchDto.is_active !== undefined) {
      queryBuilder.andWhere('category.is_active = :is_active', {
        is_active: searchDto.is_active,
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

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Tìm category theo ID
   */
  async findOne(id: number): Promise<OperatingCostCategory> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    
    if (!category) {
      throw new NotFoundException(`Không tìm thấy loại chi phí với ID ${id}`);
    }

    return category;
  }

  /**
   * Cập nhật category
   */
  async update(
    id: number,
    updateDto: UpdateOperatingCostCategoryDto,
  ): Promise<OperatingCostCategory> {
    const category = await this.findOne(id);

    // Nếu đổi code, kiểm tra trùng
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
   * Xóa category (soft delete bằng cách set is_active = false)
   */
  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);
    category.is_active = false;
    await this.categoryRepository.save(category);
  }

  /**
   * Tìm category theo code (dùng cho migration)
   */
  async findByCode(code: string): Promise<OperatingCostCategory | null> {
    return this.categoryRepository.findOne({ where: { code } });
  }
}
