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
   * Xóa nhà cung cấp theo ID
   * @param id - ID của nhà cung cấp cần xóa
   */
  async remove(id: number) {
    await this.supplierRepository.delete(id);
  }

  /**
   * Tìm kiếm nâng cao nhà cung cấp
   */
  async searchSuppliers(
    searchDto: SearchSupplierDto,
  ): Promise<{ data: Supplier[]; total: number; page: number; limit: number }> {
    const queryBuilder = this.supplierRepository.createQueryBuilder('supplier');
    queryBuilder.leftJoinAndSelect('supplier.creator', 'creator');

    // Thêm điều kiện mặc định: Nếu không có filter status thì mặc định lấy active
    // Kiểm tra xem có filter status trong flat fields hoặc filters array không
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

    // Manual status handling
    if (!searchDto.status) {
       queryBuilder.andWhere('supplier.status = :activeStatus', { activeStatus: 'active' });
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }
}
