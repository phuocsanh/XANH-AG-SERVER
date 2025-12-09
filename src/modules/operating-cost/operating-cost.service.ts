import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { OperatingCost } from '../../entities/operating-costs.entity';
import { CreateOperatingCostDto } from './dto/create-operating-cost.dto';
import { UpdateOperatingCostDto } from './dto/update-operating-cost.dto';
import { SearchOperatingCostDto } from './dto/search-operating-cost.dto';
import { FilterConditionDto } from './dto/filter-condition.dto';
import { QueryHelper } from '../../common/helpers/query-helper';

/**
 * Service xử lý logic nghiệp vụ liên quan đến chi phí vận hành
 */
@Injectable()
export class OperatingCostService {
  /**
   * Constructor injection repository cần thiết
   * @param operatingCostRepository - Repository để thao tác với entity OperatingCost
   */
  constructor(
    @InjectRepository(OperatingCost)
    private operatingCostRepository: Repository<OperatingCost>,
  ) {}

  /**
   * Tạo chi phí vận hành mới
   * @param createOperatingCostDto - Dữ liệu tạo chi phí vận hành mới
   * @returns Thông tin chi phí vận hành đã tạo
   */
  async create(
    createOperatingCostDto: CreateOperatingCostDto,
  ): Promise<OperatingCost> {
    const operatingCost = this.operatingCostRepository.create(
      createOperatingCostDto,
    );
    return this.operatingCostRepository.save(operatingCost);
  }

  /**
   * Lấy danh sách tất cả chi phí vận hành
   * @returns Danh sách chi phí vận hành
   */
  async findAll(): Promise<OperatingCost[]> {
    return this.operatingCostRepository.find();
  }

  /**
   * Tìm chi phí vận hành theo ID
   * @param id - ID của chi phí vận hành cần tìm
   * @returns Thông tin chi phí vận hành hoặc null nếu không tìm thấy
   */
  async findOne(id: number): Promise<OperatingCost | null> {
    return this.operatingCostRepository.findOne({ where: { id } });
  }

  /**
   * Cập nhật thông tin chi phí vận hành
   * @param id - ID của chi phí vận hành cần cập nhật
   * @param updateOperatingCostDto - Dữ liệu cập nhật chi phí vận hành
   * @returns Thông tin chi phí vận hành đã cập nhật
   */
  async update(
    id: number,
    updateOperatingCostDto: UpdateOperatingCostDto,
  ): Promise<OperatingCost | null> {
    await this.operatingCostRepository.update(id, updateOperatingCostDto);
    return this.findOne(id);
  }

  /**
   * Xóa chi phí vận hành theo ID
   * @param id - ID của chi phí vận hành cần xóa
   */
  async remove(id: number): Promise<void> {
    await this.operatingCostRepository.delete(id);
  }

  /**
   * Lấy tổng chi phí theo loại chi phí
   * @param costType - Loại chi phí cần tính tổng
   * @returns Tổng chi phí của loại chi phí tương ứng
   */
  async getTotalCostByType(costType: string): Promise<number> {
    const result = await this.operatingCostRepository
      .createQueryBuilder('operating_cost')
      .select('SUM(operating_cost.value)', 'total')
      .where('operating_cost.type = :costType', { costType })
      .getRawOne();

    return parseFloat(result.total) || 0;
  }

  /**
   * Lấy tổng tất cả chi phí
   * @returns Tổng tất cả chi phí
   */
  async getTotalCost(): Promise<number> {
    const result = await this.operatingCostRepository
      .createQueryBuilder('operating_cost')
      .select('SUM(operating_cost.value)', 'total')
      .getRawOne();

    return parseFloat(result.total) || 0;
  }

  /**
   * Tìm kiếm chi phí vận hành nâng cao với cấu trúc filter lồng nhau
   */
  async searchOperatingCostsAdvanced(
    searchDto: SearchOperatingCostDto,
  ): Promise<{
    data: OperatingCost[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder =
      this.operatingCostRepository.createQueryBuilder('operating_cost');

    // 1. Base Search
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'operating_cost',
      ['name', 'code', 'note'] // Global search
    );

    // 2. Simple Filters
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'operating_cost',
      ['filters', 'nested_filters', 'operator']
    );

    // 3. Backward Compatibility
    if (searchDto.filters && searchDto.filters.length > 0) {
      this.buildSearchConditions(queryBuilder, searchDto, 'operating_cost');
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
   * Xây dựng điều kiện tìm kiếm từ DTO
   * @param queryBuilder - Query builder
   * @param searchDto - DTO tìm kiếm
   * @param alias - Alias của bảng
   */
  private buildSearchConditions(
    queryBuilder: SelectQueryBuilder<OperatingCost>,
    searchDto: SearchOperatingCostDto | FilterConditionDto,
    alias: string,
  ): void {
    // Xử lý điều kiện filters
    if ('filters' in searchDto && searchDto.filters) {
      const operator = searchDto.operator || 'AND';
      const whereMethod = operator === 'OR' ? 'orWhere' : 'andWhere';

      searchDto.filters.forEach((filter, index) => {
        if (!filter.field || !filter.operator) return;

        const paramName = `${alias}_${filter.field}_${index}`;
        const fieldAlias = `${alias}.${filter.field}`;

        switch (filter.operator) {
          case 'eq':
            if (index === 0) {
              queryBuilder.where(`${fieldAlias} = :${paramName}`, {
                [paramName]: filter.value,
              });
            } else {
              queryBuilder[whereMethod](`${fieldAlias} = :${paramName}`, {
                [paramName]: filter.value,
              });
            }
            break;
          case 'ne':
            if (index === 0) {
              queryBuilder.where(`${fieldAlias} != :${paramName}`, {
                [paramName]: filter.value,
              });
            } else {
              queryBuilder[whereMethod](`${fieldAlias} != :${paramName}`, {
                [paramName]: filter.value,
              });
            }
            break;
          case 'gt':
            if (index === 0) {
              queryBuilder.where(`${fieldAlias} > :${paramName}`, {
                [paramName]: filter.value,
              });
            } else {
              queryBuilder[whereMethod](`${fieldAlias} > :${paramName}`, {
                [paramName]: filter.value,
              });
            }
            break;
          case 'lt':
            if (index === 0) {
              queryBuilder.where(`${fieldAlias} < :${paramName}`, {
                [paramName]: filter.value,
              });
            } else {
              queryBuilder[whereMethod](`${fieldAlias} < :${paramName}`, {
                [paramName]: filter.value,
              });
            }
            break;
          case 'gte':
            if (index === 0) {
              queryBuilder.where(`${fieldAlias} >= :${paramName}`, {
                [paramName]: filter.value,
              });
            } else {
              queryBuilder[whereMethod](`${fieldAlias} >= :${paramName}`, {
                [paramName]: filter.value,
              });
            }
            break;
          case 'lte':
            if (index === 0) {
              queryBuilder.where(`${fieldAlias} <= :${paramName}`, {
                [paramName]: filter.value,
              });
            } else {
              queryBuilder[whereMethod](`${fieldAlias} <= :${paramName}`, {
                [paramName]: filter.value,
              });
            }
            break;
          case 'like':
            if (index === 0) {
              queryBuilder.where(`${fieldAlias} LIKE :${paramName}`, {
                [paramName]: `%${filter.value}%`,
              });
            } else {
              queryBuilder[whereMethod](`${fieldAlias} LIKE :${paramName}`, {
                [paramName]: `%${filter.value}%`,
              });
            }
            break;
          case 'ilike':
            if (index === 0) {
              queryBuilder.where(
                `LOWER(${fieldAlias}) LIKE LOWER(:${paramName})`,
                {
                  [paramName]: `%${filter.value}%`,
                },
              );
            } else {
              queryBuilder[whereMethod](
                `LOWER(${fieldAlias}) LIKE LOWER(:${paramName})`,
                {
                  [paramName]: `%${filter.value}%`,
                },
              );
            }
            break;
          case 'in':
            if (index === 0) {
              queryBuilder.where(`${fieldAlias} IN (:...${paramName})`, {
                [paramName]: Array.isArray(filter.value)
                  ? filter.value
                  : [filter.value],
              });
            } else {
              queryBuilder[whereMethod](`${fieldAlias} IN (:...${paramName})`, {
                [paramName]: Array.isArray(filter.value)
                  ? filter.value
                  : [filter.value],
              });
            }
            break;
          case 'notin':
            if (index === 0) {
              queryBuilder.where(`${fieldAlias} NOT IN (:...${paramName})`, {
                [paramName]: Array.isArray(filter.value)
                  ? filter.value
                  : [filter.value],
              });
            } else {
              queryBuilder[whereMethod](
                `${fieldAlias} NOT IN (:...${paramName})`,
                {
                  [paramName]: Array.isArray(filter.value)
                    ? filter.value
                    : [filter.value],
                },
              );
            }
            break;
          case 'isnull':
            if (index === 0) {
              queryBuilder.where(`${fieldAlias} IS NULL`);
            } else {
              queryBuilder[whereMethod](`${fieldAlias} IS NULL`);
            }
            break;
          case 'isnotnull':
            if (index === 0) {
              queryBuilder.where(`${fieldAlias} IS NOT NULL`);
            } else {
              queryBuilder[whereMethod](`${fieldAlias} IS NOT NULL`);
            }
            break;
        }
      });
    }

    // Xử lý điều kiện nested_filters
    if ('nested_filters' in searchDto && searchDto.nested_filters) {
      searchDto.nested_filters.forEach((nestedFilter) => {
        this.buildSearchConditions(queryBuilder, nestedFilter, alias);
      });
    }
  }
}
