import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ProductType } from '../../entities/product-types.entity';
import { BaseStatus } from '../../entities/base-status.enum';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';
import { FileTrackingService } from '../file-tracking/file-tracking.service';
import { SearchProductTypeDto } from './dto/search-product-type.dto';
import { FilterConditionDto } from './dto/filter-condition.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';

/**
 * Service xử lý logic nghiệp vụ liên quan đến loại sản phẩm
 * Bao gồm các thao tác CRUD, Status Management và Soft Delete cho ProductType
 */
@Injectable()
export class ProductTypeService {
  /**
   * Constructor injection các repository và service cần thiết
   * @param productTypeRepository - Repository để thao tác với entity ProductType
   * @param fileTrackingService - Service quản lý theo dõi file
   */
  constructor(
    @InjectRepository(ProductType)
    private productTypeRepository: Repository<ProductType>,
    private fileTrackingService: FileTrackingService,
  ) {}

  /**
   * Tạo loại sản phẩm mới
   * @param createProductTypeDto - Dữ liệu tạo loại sản phẩm mới
   * @returns Thông tin loại sản phẩm đã tạo
   */
  async create(
    createProductTypeDto: CreateProductTypeDto,
  ): Promise<ProductType> {
    try {
      const productType = new ProductType();
      Object.assign(productType, createProductTypeDto);
      const savedProductType =
        await this.productTypeRepository.save(productType);
      return savedProductType;
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'loại sản phẩm');
    }
  }

  /**
   * Lấy danh sách tất cả loại sản phẩm (chỉ các bản ghi chưa bị soft delete)
   * @returns Danh sách loại sản phẩm
   */
  async findAll(): Promise<ProductType[]> {
    return this.productTypeRepository
      .createQueryBuilder('productType')
      .where('productType.deletedAt IS NULL')
      .getMany();
  }

  /**
   * Lấy danh sách loại sản phẩm theo trạng thái
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @returns Danh sách loại sản phẩm theo trạng thái
   */
  async findByStatus(status: BaseStatus): Promise<ProductType[]> {
    return this.productTypeRepository
      .createQueryBuilder('productType')
      .where('productType.status = :status', { status })
      .andWhere('productType.deletedAt IS NULL')
      .getMany();
  }

  /**
   * Tìm loại sản phẩm theo ID (chỉ các bản ghi chưa bị soft delete)
   * @param id - ID của loại sản phẩm cần tìm
   * @returns Thông tin loại sản phẩm hoặc null nếu không tìm thấy
   */
  async findOne(id: number): Promise<ProductType | null> {
    return this.productTypeRepository
      .createQueryBuilder('productType')
      .where('productType.id = :id', { id })
      .andWhere('productType.deletedAt IS NULL')
      .getOne();
  }

  /**
   * Cập nhật thông tin loại sản phẩm chỉ sử dụng status
   * @param id - ID của loại sản phẩm cần cập nhật
   * @param updateProductTypeDto - Dữ liệu cập nhật loại sản phẩm
   * @returns Thông tin loại sản phẩm đã cập nhật
   */
  async update(
    id: number,
    updateProductTypeDto: UpdateProductTypeDto,
  ): Promise<ProductType | null> {
    try {
      await this.productTypeRepository.update(id, updateProductTypeDto);
      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'loại sản phẩm');
    }
  }

  /**
   * Kích hoạt loại sản phẩm (chuyển trạng thái thành active)
   * @param id - ID của loại sản phẩm cần kích hoạt
   * @returns Thông tin loại sản phẩm đã kích hoạt
   */
  async activate(id: number): Promise<ProductType | null> {
    await this.productTypeRepository.update(id, {
      status: BaseStatus.ACTIVE,
    });
    return this.findOne(id);
  }

  /**
   * Vô hiệu hóa loại sản phẩm (chuyển trạng thái thành inactive)
   * @param id - ID của loại sản phẩm cần vô hiệu hóa
   * @returns Thông tin loại sản phẩm đã vô hiệu hóa
   */
  async deactivate(id: number): Promise<ProductType | null> {
    await this.productTypeRepository.update(id, {
      status: BaseStatus.INACTIVE,
    });
    return this.findOne(id);
  }

  /**
   * Lưu trữ loại sản phẩm (chuyển trạng thái thành archived)
   * @param id - ID của loại sản phẩm cần lưu trữ
   * @returns Thông tin loại sản phẩm đã lưu trữ
   */
  async archive(id: number): Promise<ProductType | null> {
    await this.productTypeRepository.update(id, {
      status: BaseStatus.ARCHIVED,
    });
    return this.findOne(id);
  }

  /**
   * Soft delete loại sản phẩm (đánh dấu deletedAt)
   * @param id - ID của loại sản phẩm cần soft delete
   */
  async softDelete(id: number): Promise<void> {
    await this.productTypeRepository.softDelete(id);
  }

  /**
   * Khôi phục loại sản phẩm đã bị soft delete
   * @param id - ID của loại sản phẩm cần khôi phục
   * @returns Thông tin loại sản phẩm đã khôi phục
   */
  async restore(id: number): Promise<ProductType | null> {
    await this.productTypeRepository.restore(id);
    return this.productTypeRepository.findOne({ where: { id } });
  }

  /**
   * Xóa vĩnh viễn loại sản phẩm theo ID (hard delete)
   * @param id - ID của loại sản phẩm cần xóa vĩnh viễn
   */
  async remove(id: number): Promise<void> {
    // Xóa tất cả file references liên quan đến loại sản phẩm trước khi xóa
    await this.fileTrackingService.batchRemoveEntityFileReferences(
      'ProductType',
      id,
    );

    // Xóa vĩnh viễn loại sản phẩm
    await this.productTypeRepository.delete(id);
  }

  /**
   * Tìm kiếm nâng cao loại sản phẩm
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách loại sản phẩm phù hợp
   */
  async searchProductTypes(
    searchDto: SearchProductTypeDto,
  ): Promise<ProductType[]> {
    const queryBuilder =
      this.productTypeRepository.createQueryBuilder('productType');

    // Thêm điều kiện mặc định
    queryBuilder.where('productType.deletedAt IS NULL');

    // Xây dựng điều kiện tìm kiếm
    this.buildSearchConditions(queryBuilder, searchDto, 'productType');

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
    queryBuilder: SelectQueryBuilder<ProductType>,
    searchDto: SearchProductTypeDto,
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
