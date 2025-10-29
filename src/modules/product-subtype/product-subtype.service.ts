import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ProductSubtype } from '../../entities/product-subtypes.entity';
import { BaseStatus } from '../../entities/base-status.enum';
import { CreateProductSubtypeDto } from './dto/create-product-subtype.dto';
import { UpdateProductSubtypeDto } from './dto/update-product-subtype.dto';
import { FileTrackingService } from '../file-tracking/file-tracking.service';
import { SearchProductSubtypeDto } from './dto/search-product-subtype.dto';
import { FilterConditionDto } from './dto/filter-condition.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';

/**
 * Service xử lý logic nghiệp vụ liên quan đến nhóm sản phẩm
 * Bao gồm các thao tác CRUD, Status Management và Soft Delete cho ProductSubtype
 */
@Injectable()
export class ProductSubtypeService {
  /**
   * Constructor injection các repository và service cần thiết
   * @param productSubtypeRepository - Repository để thao tác với entity ProductSubtype
   * @param fileTrackingService - Service quản lý theo dõi file
   */
  constructor(
    @InjectRepository(ProductSubtype)
    private productSubtypeRepository: Repository<ProductSubtype>,
    private fileTrackingService: FileTrackingService,
  ) {}

  /**
   * Tạo nhóm sản phẩm mới
   * @param createProductSubtypeDto - Dữ liệu tạo nhóm sản phẩm mới
   * @returns Thông tin nhóm sản phẩm đã tạo
   */
  async create(
    createProductSubtypeDto: CreateProductSubtypeDto,
  ): Promise<ProductSubtype> {
    try {
      const productSubtype = new ProductSubtype();
      Object.assign(productSubtype, createProductSubtypeDto);
      const savedProductSubtype =
        await this.productSubtypeRepository.save(productSubtype);
      return savedProductSubtype;
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'nhóm sản phẩm');
    }
  }

  /**
   * Lấy danh sách tất cả nhóm sản phẩm (chỉ các bản ghi chưa bị soft delete)
   * @returns Danh sách nhóm sản phẩm
   */
  async findAll(): Promise<ProductSubtype[]> {
    return this.productSubtypeRepository
      .createQueryBuilder('productSubtype')
      .where('productSubtype.deletedAt IS NULL')
      .getMany();
  }

  /**
   * Lấy danh sách nhóm sản phẩm theo trạng thái
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @returns Danh sách nhóm sản phẩm theo trạng thái
   */
  async findByStatus(status: BaseStatus): Promise<ProductSubtype[]> {
    return this.productSubtypeRepository
      .createQueryBuilder('productSubtype')
      .where('productSubtype.status = :status', { status })
      .andWhere('productSubtype.deletedAt IS NULL')
      .getMany();
  }

  /**
   * Tìm nhóm sản phẩm theo ID (chỉ các bản ghi chưa bị soft delete)
   * @param id - ID của nhóm sản phẩm cần tìm
   * @returns Thông tin nhóm sản phẩm hoặc null nếu không tìm thấy
   */
  async findOne(id: number): Promise<ProductSubtype | null> {
    return this.productSubtypeRepository
      .createQueryBuilder('productSubtype')
      .where('productSubtype.id = :id', { id })
      .andWhere('productSubtype.deletedAt IS NULL')
      .getOne();
  }

  /**
   * Cập nhật thông tin nhóm sản phẩm
   * @param id - ID của nhóm sản phẩm cần cập nhật
   * @param updateProductSubtypeDto - Dữ liệu cập nhật nhóm sản phẩm
   * @returns Thông tin nhóm sản phẩm đã cập nhật
   */
  async update(
    id: number,
    updateProductSubtypeDto: UpdateProductSubtypeDto,
  ): Promise<ProductSubtype | null> {
    try {
      await this.productSubtypeRepository.update(id, updateProductSubtypeDto);
      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'nhóm sản phẩm');
    }
  }

  /**
   * Kích hoạt nhóm sản phẩm (chuyển status thành 'active')
   * @param id - ID của nhóm sản phẩm cần kích hoạt
   * @returns Thông tin nhóm sản phẩm đã kích hoạt
   */
  async activate(id: number): Promise<ProductSubtype | null> {
    await this.productSubtypeRepository.update(id, {
      status: BaseStatus.ACTIVE,
    });
    return this.findOne(id);
  }

  /**
   * Vô hiệu hóa nhóm sản phẩm (chuyển status thành 'inactive')
   * @param id - ID của nhóm sản phẩm cần vô hiệu hóa
   * @returns Thông tin nhóm sản phẩm đã vô hiệu hóa
   */
  async deactivate(id: number): Promise<ProductSubtype | null> {
    await this.productSubtypeRepository.update(id, {
      status: BaseStatus.INACTIVE,
    });
    return this.findOne(id);
  }

  /**
   * Lưu trữ nhóm sản phẩm (chuyển status thành 'archived')
   * @param id - ID của nhóm sản phẩm cần lưu trữ
   * @returns Thông tin nhóm sản phẩm đã lưu trữ
   */
  async archive(id: number): Promise<ProductSubtype | null> {
    await this.productSubtypeRepository.update(id, {
      status: BaseStatus.ARCHIVED,
    });
    return this.findOne(id);
  }

  /**
   * Soft delete nhóm sản phẩm (đánh dấu deletedAt)
   * @param id - ID của nhóm sản phẩm cần soft delete
   */
  async softRemove(id: number): Promise<void> {
    await this.productSubtypeRepository.softDelete(id);
  }

  /**
   * Khôi phục nhóm sản phẩm đã bị soft delete
   * @param id - ID của nhóm sản phẩm cần khôi phục
   * @returns Thông tin nhóm sản phẩm đã khôi phục
   */
  async restore(id: number): Promise<ProductSubtype | null> {
    await this.productSubtypeRepository.restore(id);
    return this.findOne(id);
  }

  /**
   * Hard delete nhóm sản phẩm (xóa vĩnh viễn khỏi database)
   * @param id - ID của nhóm sản phẩm cần xóa vĩnh viễn
   */
  async remove(id: number): Promise<void> {
    // Xóa tất cả file references liên quan đến nhóm sản phẩm trước khi xóa
    await this.fileTrackingService.batchRemoveEntityFileReferences(
      'ProductSubtype',
      id,
    );

    // Hard delete nhóm sản phẩm
    await this.productSubtypeRepository.delete(id);
  }

  /**
   * Lấy danh sách nhóm sản phẩm đã bị soft delete
   * @returns Danh sách nhóm sản phẩm đã bị soft delete
   */
  async findDeleted(): Promise<ProductSubtype[]> {
    return this.productSubtypeRepository
      .createQueryBuilder('productSubtype')
      .withDeleted()
      .where('productSubtype.deletedAt IS NOT NULL')
      .getMany();
  }

  /**
   * Tìm kiếm nâng cao nhóm sản phẩm
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách nhóm sản phẩm phù hợp với thông tin phân trang
   */
  async searchProductSubtypes(
    searchDto: SearchProductSubtypeDto,
  ): Promise<{
    data: ProductSubtype[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder =
      this.productSubtypeRepository.createQueryBuilder('productSubtype');

    // Thêm điều kiện mặc định
    queryBuilder.where('productSubtype.deletedAt IS NULL');

    // Xây dựng điều kiện tìm kiếm
    this.buildSearchConditions(queryBuilder, searchDto, 'productSubtype');

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
   * Tìm nhóm sản phẩm theo loại sản phẩm
   * @param productTypeId - ID của loại sản phẩm
   * @returns Danh sách nhóm sản phẩm thuộc loại sản phẩm đó
   */
  async findByProductType(productTypeId: number): Promise<ProductSubtype[]> {
    return this.productSubtypeRepository.find({
      where: { productTypeId },
      order: { name: 'ASC' },
    });
  }

  /**
   * Xây dựng các điều kiện tìm kiếm động
   * @param queryBuilder - Query builder
   * @param searchDto - DTO tìm kiếm
   * @param alias - Alias của bảng
   * @param parameterIndex - Chỉ số để tạo parameter name duy nhất
   */
  private buildSearchConditions(
    queryBuilder: SelectQueryBuilder<ProductSubtype>,
    searchDto: SearchProductSubtypeDto,
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
