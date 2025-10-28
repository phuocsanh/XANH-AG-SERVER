import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, SelectQueryBuilder } from 'typeorm';
import { Unit } from '../../entities/unit.entity';
import { BaseStatus } from '../../entities/base-status.enum';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { SearchUnitDto } from './dto/search-unit.dto';
import { FilterConditionDto } from './dto/filter-condition.dto';

/**
 * Service xử lý logic nghiệp vụ liên quan đến đơn vị tính
 * Bao gồm quản lý đơn vị tính, Status Management và Soft Delete
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
    const unit = this.unitRepository.create(createUnitDto);
    return this.unitRepository.save(unit);
  }

  /**
   * Lấy danh sách tất cả đơn vị tính (chỉ các bản ghi chưa bị soft delete và đang hoạt động)
   * @returns Danh sách đơn vị tính
   */
  async findAll(): Promise<Unit[]> {
    return this.unitRepository.find({
      where: {
        status: BaseStatus.ACTIVE,
        deletedAt: IsNull(),
      },
    });
  }

  /**
   * Lấy danh sách đơn vị tính theo trạng thái
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @returns Danh sách đơn vị tính theo trạng thái
   */
  async findByStatus(status: BaseStatus): Promise<Unit[]> {
    return this.unitRepository.find({
      where: {
        status,
        deletedAt: IsNull(),
      },
    });
  }

  /**
   * Tìm đơn vị tính theo ID (chỉ các bản ghi chưa bị soft delete)
   * @param id - ID của đơn vị tính cần tìm
   * @returns Thông tin đơn vị tính hoặc null nếu không tìm thấy
   */
  async findOne(id: number): Promise<Unit | null> {
    return this.unitRepository.findOne({
      where: {
        id,
        deletedAt: IsNull(),
      },
    });
  }

  /**
   * Cập nhật thông tin đơn vị tính
   * @param id - ID của đơn vị tính cần cập nhật
   * @param updateUnitDto - Dữ liệu cập nhật đơn vị tính
   * @returns Thông tin đơn vị tính đã cập nhật
   */
  async update(id: number, updateUnitDto: UpdateUnitDto): Promise<Unit | null> {
    await this.unitRepository.update(id, updateUnitDto);
    return this.findOne(id);
  }

  /**
   * Kích hoạt đơn vị tính (chuyển trạng thái thành active)
   * @param id - ID của đơn vị tính cần kích hoạt
   * @returns Thông tin đơn vị tính đã kích hoạt
   */
  async activate(id: number): Promise<Unit | null> {
    await this.unitRepository.update(id, { status: BaseStatus.ACTIVE });
    return this.findOne(id);
  }

  /**
   * Vô hiệu hóa đơn vị tính (chuyển trạng thái thành inactive)
   * @param id - ID của đơn vị tính cần vô hiệu hóa
   * @returns Thông tin đơn vị tính đã vô hiệu hóa
   */
  async deactivate(id: number): Promise<Unit | null> {
    await this.unitRepository.update(id, { status: BaseStatus.INACTIVE });
    return this.findOne(id);
  }

  /**
   * Lưu trữ đơn vị tính (chuyển trạng thái thành archived)
   * @param id - ID của đơn vị tính cần lưu trữ
   * @returns Thông tin đơn vị tính đã lưu trữ
   */
  async archive(id: number): Promise<Unit | null> {
    await this.unitRepository.update(id, { status: BaseStatus.ARCHIVED });
    return this.findOne(id);
  }

  /**
   * Soft delete đơn vị tính (đánh dấu deletedAt)
   * @param id - ID của đơn vị tính cần soft delete
   */
  async softDelete(id: number): Promise<void> {
    await this.unitRepository.softDelete(id);
  }

  /**
   * Khôi phục đơn vị tính đã bị soft delete
   * @param id - ID của đơn vị tính cần khôi phục
   * @returns Thông tin đơn vị tính đã khôi phục
   */
  async restore(id: number): Promise<Unit | null> {
    await this.unitRepository.restore(id);
    return this.unitRepository.findOne({ where: { id } });
  }

  /**
   * Xóa cứng đơn vị tính theo ID (hard delete)
   * @param id - ID của đơn vị tính cần xóa
   */
  async remove(id: number): Promise<void> {
    await this.unitRepository.delete(id);
  }

  /**
   * Tìm kiếm nâng cao đơn vị tính
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách đơn vị tính phù hợp
   */
  async searchUnits(searchDto: SearchUnitDto): Promise<Unit[]> {
    const queryBuilder = this.unitRepository.createQueryBuilder('unit');

    // Thêm điều kiện mặc định
    queryBuilder
      .where('unit.status = :status', { status: BaseStatus.ACTIVE })
      .andWhere('unit.deletedAt IS NULL');

    // Xây dựng điều kiện tìm kiếm
    this.buildSearchConditions(queryBuilder, searchDto, 'unit');

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
