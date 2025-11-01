import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Symbol } from '../../entities/symbols.entity';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { SearchSymbolDto } from './dto/search-symbol.dto';
import { BaseStatus } from '../../entities/base-status.enum';

/**
 * Service xử lý logic nghiệp vụ liên quan đến ký hiệu
 * Bao gồm các thao tác CRUD cho Symbol
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
    try {
      const symbol = this.symbolRepository.create(symbolData);
      return this.symbolRepository.save(symbol);
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'ký hiệu');
    }
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
   * @returns Thông tin ký hiệu
   */
  async findOne(id: number): Promise<Symbol | null> {
    return this.symbolRepository.findOne({ where: { id } });
  }

  /**
   * Lấy danh sách ký hiệu theo trạng thái
   * @param status - Trạng thái cần lọc
   * @returns Danh sách ký hiệu theo trạng thái
   */
  async findByStatus(status: BaseStatus): Promise<Symbol[]> {
    return this.symbolRepository.find({
      where: { status },
    });
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
    try {
      await this.symbolRepository.update(id, updateData);
      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'ký hiệu');
    }
  }

  /**
   * Kích hoạt ký hiệu
   * @param id - ID của ký hiệu cần kích hoạt
   * @returns Thông tin ký hiệu đã kích hoạt
   */
  async activate(id: number): Promise<Symbol | null> {
    await this.symbolRepository.update(id, { status: BaseStatus.ACTIVE });
    return this.findOne(id);
  }

  /**
   * Vô hiệu hóa ký hiệu
   * @param id - ID của ký hiệu cần vô hiệu hóa
   * @returns Thông tin ký hiệu đã vô hiệu hóa
   */
  async deactivate(id: number): Promise<Symbol | null> {
    await this.symbolRepository.update(id, { status: BaseStatus.INACTIVE });
    return this.findOne(id);
  }

  /**
   * Lưu trữ ký hiệu
   * @param id - ID của ký hiệu cần lưu trữ
   * @returns Thông tin ký hiệu đã lưu trữ
   */
  async archive(id: number): Promise<Symbol | null> {
    await this.symbolRepository.update(id, { status: BaseStatus.ARCHIVED });
    return this.findOne(id);
  }

  /**
   * Xóa mềm ký hiệu (soft delete)
   * @param id - ID của ký hiệu cần xóa mềm
   */
  async softDelete(id: number): Promise<void> {
    await this.symbolRepository.softDelete(id);
  }

  /**
   * Khôi phục ký hiệu đã bị xóa mềm
   * @param id - ID của ký hiệu cần khôi phục
   * @returns Thông tin ký hiệu đã khôi phục
   */
  async restore(id: number): Promise<Symbol | null> {
    await this.symbolRepository.restore(id);
    return this.symbolRepository.findOne({ where: { id } });
  }

  /**
   * Xóa ký hiệu theo ID
   * @param id - ID của ký hiệu cần xóa
   */
  async remove(id: number): Promise<void> {
    await this.symbolRepository.delete(id);
  }

  /**
   * Tìm kiếm ký hiệu theo điều kiện
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách ký hiệu phù hợp với thông tin phân trang
   */
  async searchSymbols(
    searchDto: SearchSymbolDto,
  ): Promise<{ data: Symbol[]; total: number; page: number; limit: number }> {
    const queryBuilder = this.symbolRepository.createQueryBuilder('symbol');

    // Thêm điều kiện tìm kiếm nếu có
    if (searchDto.filters && searchDto.filters.length > 0) {
      searchDto.filters.forEach((filter: any, index: number) => {
        if (filter.field && filter.operator && filter.value !== undefined) {
          const paramName = `param_${index}`;
          const field = `symbol.${filter.field}`;

          switch (filter.operator) {
            case 'eq':
              queryBuilder.andWhere(`${field} = :${paramName}`, {
                [paramName]: filter.value,
              });
              break;
            case 'like':
              queryBuilder.andWhere(`${field} ILIKE :${paramName}`, {
                [paramName]: `%${filter.value}%`,
              });
              break;
            // Thêm các operator khác nếu cần
          }
        }
      });
    }

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
}
