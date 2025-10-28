import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Symbol } from '../../entities/symbols.entity';
import { SearchSymbolDto } from './dto/search-symbol.dto';
import { FilterConditionDto } from './dto/filter-condition.dto';

/**
 * Service xử lý logic nghiệp vụ liên quan đến ký hiệu sản phẩm
 * Bao gồm quản lý ký hiệu
 */
@Injectable()
export class SymbolService {
  /**
   * Constructor injection repository cần thiết
   * @param symbolRepository - Repository để thao tác với entity Symbol
   */
  constructor(
    @InjectRepository(Symbol)
    private symbolRepository: Repository<Symbol>,
  ) {}

  /**
   * Tạo ký hiệu mới
   * @param symbolData - Dữ liệu tạo ký hiệu mới
   * @returns Thông tin ký hiệu đã tạo
   */
  async create(symbolData: Partial<Symbol>): Promise<Symbol> {
    const symbol = this.symbolRepository.create(symbolData);
    return this.symbolRepository.save(symbol);
  }

  /**
   * Lấy danh sách tất cả ký hiệu
   * @returns Danh sách ký hiệu
   */
  async findAll(): Promise<Symbol[]> {
    return this.symbolRepository.find();
  }

  /**
   * Tìm ký hiệu theo ID
   * @param id - ID của ký hiệu cần tìm
   * @returns Thông tin ký hiệu hoặc null nếu không tìm thấy
   */
  async findOne(id: number): Promise<Symbol | null> {
    return this.symbolRepository.findOne({ where: { id } });
  }

  /**
   * Cập nhật thông tin ký hiệu
   * @param id - ID của ký hiệu cần cập nhật
   * @param updateData - Dữ liệu cập nhật ký hiệu
   * @returns Thông tin ký hiệu đã cập nhật
   */
  async update(
    id: number,
    updateData: Partial<Symbol>,
  ): Promise<Symbol | null> {
    await this.symbolRepository.update(id, updateData);
    return this.findOne(id);
  }

  /**
   * Xóa ký hiệu theo ID
   * @param id - ID của ký hiệu cần xóa
   */
  async remove(id: number): Promise<void> {
    await this.symbolRepository.delete(id);
  }

  /**
   * Tìm kiếm nâng cao ký hiệu
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách ký hiệu phù hợp
   */
  async searchSymbols(searchDto: SearchSymbolDto): Promise<Symbol[]> {
    const queryBuilder = this.symbolRepository.createQueryBuilder('symbol');

    // Xây dựng điều kiện tìm kiếm
    this.buildSearchConditions(queryBuilder, searchDto, 'symbol');

    return await queryBuilder.getMany();
  }

  /**
   * Xây dựng các điều kiện tìm kiếm động
   * @param queryBuilder - Query builder
   * @param searchDto - DTO tìm kiếm
   * @param alias - Alias của bảng
   * @param parameterIndex - Chỉ số để tạo parameter name duy nhất
   */
  private buildSearchConditions(
    queryBuilder: SelectQueryBuilder<Symbol>,
    searchDto: SearchSymbolDto,
    alias: string,
    parameterIndex: number = 0,
  ): number {
    // Xử lý các điều kiện lọc cơ bản
    if (searchDto.filters && searchDto.filters.length > 0) {
      const operator = searchDto.operator || 'AND';
      const conditions: string[] = [];
      const parameters: { [key: string]: any } = {};

      searchDto.filters.forEach((filter, index) => {
        const condition = this.buildFilterCondition(
          filter,
          alias,
          parameterIndex + index,
          parameters,
        );
        if (condition) {
          conditions.push(condition);
        }
      });

      if (conditions.length > 0) {
        const combinedCondition = conditions.join(` ${operator} `);
        queryBuilder.andWhere(`(${combinedCondition})`, parameters);
      }

      parameterIndex += searchDto.filters.length;
    }

    // Xử lý các bộ lọc lồng nhau
    if (searchDto.nestedFilters && searchDto.nestedFilters.length > 0) {
      // Xây dựng điều kiện cho từng bộ lọc lồng nhau
      searchDto.nestedFilters.forEach((nestedFilter) => {
        parameterIndex = this.buildSearchConditions(
          queryBuilder,
          nestedFilter,
          alias,
          parameterIndex,
        );
      });
    }

    return parameterIndex;
  }

  /**
   * Xây dựng điều kiện lọc đơn lẻ
   * @param filter - Điều kiện lọc
   * @param alias - Alias của bảng
   * @param index - Chỉ số để tạo parameter name duy nhất
   * @param parameters - Object chứa các parameter
   * @returns Chuỗi điều kiện SQL
   */
  private buildFilterCondition(
    filter: FilterConditionDto,
    alias: string,
    index: number,
    parameters: { [key: string]: any },
  ): string | null {
    if (!filter.field || !filter.operator) {
      return null;
    }

    const paramName = `param_${index}`;
    const field = `${alias}.${filter.field}`;

    switch (filter.operator) {
      case 'eq':
        parameters[paramName] = filter.value;
        return `${field} = :${paramName}`;
      case 'ne':
        parameters[paramName] = filter.value;
        return `${field} != :${paramName}`;
      case 'gt':
        parameters[paramName] = filter.value;
        return `${field} > :${paramName}`;
      case 'lt':
        parameters[paramName] = filter.value;
        return `${field} < :${paramName}`;
      case 'gte':
        parameters[paramName] = filter.value;
        return `${field} >= :${paramName}`;
      case 'lte':
        parameters[paramName] = filter.value;
        return `${field} <= :${paramName}`;
      case 'like':
        parameters[paramName] = `%${filter.value}%`;
        return `${field} LIKE :${paramName}`;
      case 'ilike':
        parameters[paramName] = `%${filter.value}%`;
        return `LOWER(${field}) LIKE LOWER(:${paramName})`;
      case 'in':
        if (Array.isArray(filter.value)) {
          parameters[paramName] = filter.value;
          return `${field} IN (:...${paramName})`;
        }
        return null;
      case 'notin':
        if (Array.isArray(filter.value)) {
          parameters[paramName] = filter.value;
          return `${field} NOT IN (:...${paramName})`;
        }
        return null;
      case 'isnull':
        return `${field} IS NULL`;
      case 'isnotnull':
        return `${field} IS NOT NULL`;
      default:
        return null;
    }
  }
}
