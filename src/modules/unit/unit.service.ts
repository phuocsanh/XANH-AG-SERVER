import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Unit } from '../../entities/unit.entity';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { SearchUnitDto } from './dto/search-unit.dto';
import { FilterConditionDto } from './dto/filter-condition.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { BaseStatus } from '../../entities/base-status.enum';

/**
 * Service xử lý logic nghiệp vụ liên quan đến đơn vị tính
 * Bao gồm các thao tác CRUD cho Unit
 */
@Injectable()
export class UnitService {
  /**
   * Constructor injection repository cần thiết
   * @param unitRepository - Repository để thao tác với entity Unit
   */
  constructor(
    @InjectRepository(Unit)
    private unitRepository: Repository<Unit>,
  ) {}

  /**
   * Tạo đơn vị tính mới
   * @param createUnitDto - Dữ liệu tạo đơn vị tính mới
   * @returns Thông tin đơn vị tính đã tạo
   */
  async create(createUnitDto: CreateUnitDto): Promise<Unit> {
    try {
      const unit = this.unitRepository.create(createUnitDto);
      return this.unitRepository.save(unit);
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'đơn vị tính');
    }
  }

  /**
   * Lấy danh sách tất cả đơn vị tính
   * @returns Danh sách đơn vị tính
   */
  async findAll(): Promise<Unit[]> {
    return this.unitRepository.find();
  }

  /**
   * Tìm đơn vị tính theo ID
   * @param id - ID của đơn vị tính cần tìm
   * @returns Thông tin đơn vị tính
   */
  async findOne(id: number): Promise<Unit | null> {
    return this.unitRepository.findOne({ where: { id } });
  }

  /**
   * Cập nhật thông tin đơn vị tính
   * @param id - ID của đơn vị tính cần cập nhật
   * @param updateUnitDto - Dữ liệu cập nhật đơn vị tính
   * @returns Thông tin đơn vị tính đã cập nhật
   */
  async update(id: number, updateUnitDto: UpdateUnitDto): Promise<Unit | null> {
    try {
      await this.unitRepository.update(id, updateUnitDto);
      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'đơn vị tính');
    }
  }

  /**
   * Xóa đơn vị tính theo ID
   * @param id - ID của đơn vị tính cần xóa
   */
  async remove(id: number): Promise<void> {
    await this.unitRepository.delete(id);
  }

  /**
   * Lấy danh sách đơn vị tính theo trạng thái
   * @param status - Trạng thái cần lọc
   * @returns Danh sách đơn vị tính theo trạng thái
   */
  async findByStatus(status: BaseStatus): Promise<Unit[]> {
    return this.unitRepository.find({
      where: { status },
    });
  }

  /**
   * Kích hoạt đơn vị tính
   * @param id - ID của đơn vị tính cần kích hoạt
   * @returns Thông tin đơn vị tính đã kích hoạt
   */
  async activate(id: number): Promise<Unit | null> {
    await this.unitRepository.update(id, { status: BaseStatus.ACTIVE });
    return this.findOne(id);
  }

  /**
   * Vô hiệu hóa đơn vị tính
   * @param id - ID của đơn vị tính cần vô hiệu hóa
   * @returns Thông tin đơn vị tính đã vô hiệu hóa
   */
  async deactivate(id: number): Promise<Unit | null> {
    await this.unitRepository.update(id, { status: BaseStatus.INACTIVE });
    return this.findOne(id);
  }

  /**
   * Lưu trữ đơn vị tính
   * @param id - ID của đơn vị tính cần lưu trữ
   * @returns Thông tin đơn vị tính đã lưu trữ
   */
  async archive(id: number): Promise<Unit | null> {
    await this.unitRepository.update(id, { status: BaseStatus.ARCHIVED });
    return this.findOne(id);
  }

  /**
   * Xóa mềm đơn vị tính (soft delete)
   * @param id - ID của đơn vị tính cần xóa mềm
   */
  async softDelete(id: number): Promise<void> {
    await this.unitRepository.softDelete(id);
  }

  /**
   * Khôi phục đơn vị tính đã bị xóa mềm
   * @param id - ID của đơn vị tính cần khôi phục
   * @returns Thông tin đơn vị tính đã khôi phục
   */
  async restore(id: number): Promise<Unit | null> {
    await this.unitRepository.restore(id);
    return this.unitRepository.findOne({ where: { id } });
  }

  /**
   * Tìm kiếm nâng cao đơn vị tính
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách đơn vị tính phù hợp với thông tin phân trang
   */
  async searchUnits(
    searchDto: SearchUnitDto,
  ): Promise<{ data: Unit[]; total: number; page: number; limit: number }> {
    const queryBuilder = this.unitRepository.createQueryBuilder('unit');

    // Xây dựng điều kiện tìm kiếm
    this.buildSearchConditions(queryBuilder, searchDto, 'unit');

    // Xử lý phân trang
    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const offset = (page - 1) * limit;

    queryBuilder.skip(offset).take(limit);

    // Thực hiện truy vấn
    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Xây dựng các điều kiện tìm kiếm động
   * @param queryBuilder - Query builder
   * @param searchDto - DTO tìm kiếm
   * @param alias - Alias của bảng
   * @param parameterIndex - Chỉ số để tạo parameter name duy nhất
   */
  private buildSearchConditions(
    queryBuilder: SelectQueryBuilder<Unit>,
    searchDto: SearchUnitDto,
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
