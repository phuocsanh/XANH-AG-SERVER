import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../../entities/suppliers.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SearchSupplierDto } from './dto/search-supplier.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { QueryHelper } from '../../common/helpers/query-helper';
import { CodeGeneratorHelper } from '../../common/helpers/code-generator.helper';

/**
 * Service xử lý logic nghiệp vụ liên quan đến nhà cung cấp
 */
@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
  ) {}

  /**
   * Tạo nhà cung cấp mới
   * @param createSupplierDto - Dữ liệu tạo nhà cung cấp mới
   * @param userId - ID người tạo
   * @returns Thông tin nhà cung cấp đã tạo
   */
  async create(createSupplierDto: CreateSupplierDto, userId: number) {
    try {
      // Auto-generate code nếu không được cung cấp
      if (!createSupplierDto.code) {
        createSupplierDto.code = CodeGeneratorHelper.generateCode('SUP');
      }

      const supplier = this.supplierRepository.create({
        ...createSupplierDto,
        created_by: userId,
      });
      return await this.supplierRepository.save(supplier);
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'nhà cung cấp');
    }
  }

  /**
   * Lấy danh sách tất cả nhà cung cấp
   * @returns Danh sách nhà cung cấp
   */
  async findAll() {
    return this.supplierRepository.find({
      relations: ['creator'],
    });
  }

  /**
   * Tìm nhà cung cấp theo ID
   * @param id - ID của nhà cung cấp cần tìm
   * @returns Thông tin nhà cung cấp
   */
  async findOne(id: number) {
    return this.supplierRepository.findOne({
      where: { id },
      relations: ['creator'],
    });
  }

  /**
   * Cập nhật thông tin nhà cung cấp
   * @param id - ID của nhà cung cấp cần cập nhật
   * @param updateSupplierDto - Dữ liệu cập nhật nhà cung cấp
   * @returns Thông tin nhà cung cấp đã cập nhật
   */
  async update(id: number, updateSupplierDto: UpdateSupplierDto) {
    try {
      await this.supplierRepository.update(id, updateSupplierDto);
      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'nhà cung cấp');
    }
  }

  /**
   * Soft delete nhà cung cấp (đánh dấu deleted_at)
   * @param id - ID của nhà cung cấp cần soft delete
   */
  async softDelete(id: number): Promise<void> {
    await this.supplierRepository.softDelete(id);
  }

  /**
   * Khôi phục nhà cung cấp đã bị soft delete
   * @param id - ID của nhà cung cấp cần khôi phục
   * @returns Thông tin nhà cung cấp đã khôi phục
   */
  async restore(id: number): Promise<Supplier | null> {
    await this.supplierRepository.restore(id);
    return this.supplierRepository.findOne({ 
      where: { id },
      relations: ['creator']
    });
  }

  /**
   * Lấy danh sách nhà cung cấp đã bị soft delete
   * @returns Danh sách nhà cung cấp đã bị soft delete
   */
  async findDeleted(): Promise<Supplier[]> {
    return this.supplierRepository
      .createQueryBuilder('supplier')
      .withDeleted()
      .where('supplier.deleted_at IS NOT NULL')
      .leftJoinAndSelect('supplier.creator', 'creator')
      .getMany();
  }

  /**
   * Tìm kiếm nâng cao nhà cung cấp
   */
  async searchSuppliers(
    searchDto: SearchSupplierDto,
  ): Promise<{ data: Supplier[]; total: number; page: number; limit: number }> {
    const queryBuilder = this.supplierRepository.createQueryBuilder('supplier');
    queryBuilder.leftJoinAndSelect('supplier.creator', 'creator');

    // Kiểm tra xem có filter deleted_at không
    const hasDeletedFilter = searchDto.filters?.some(
      (filter) => filter.field === 'deleted_at',
    );

    // Thêm điều kiện mặc định chỉ khi không có filter deleted_at
    if (!hasDeletedFilter) {
      queryBuilder.where('supplier.deleted_at IS NULL');
    } else {
      // Nếu có filter deleted_at, cần sử dụng withDeleted() để bao gồm các bản ghi đã xóa
      queryBuilder.withDeleted();

      // Kiểm tra xem filter deleted_at có giá trị là isnotnull không
      const deletedFilter = searchDto.filters?.find(
        (filter) => filter.field === 'deleted_at',
      );

      if (deletedFilter && deletedFilter.operator === 'isnotnull') {
        // Nếu đang tìm kiếm các bản ghi đã xóa, không cần thêm điều kiện mặc định
        queryBuilder.where('supplier.deleted_at IS NOT NULL');
      } else if (deletedFilter && deletedFilter.operator === 'isnull') {
        // Nếu đang tìm kiếm các bản ghi chưa xóa, thêm điều kiện này
        queryBuilder.where('supplier.deleted_at IS NULL');
      }
    }

    // 1. Base Search
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'supplier',
      ['name', 'code', 'phone', 'address', 'email'] // Global search
    );

    // 2. Simple Filters
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'supplier',
      ['filters', 'nested_filters', 'operator']
    );

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }
}
