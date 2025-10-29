import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Symbol } from '../../entities/symbols.entity';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';

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
   * Xóa ký hiệu theo ID
   * @param id - ID của ký hiệu cần xóa
   */
  async remove(id: number): Promise<void> {
    await this.symbolRepository.delete(id);
  }

  /**
   * Tìm kiếm ký hiệu theo điều kiện
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách ký hiệu phù hợp
   */
  async searchSymbols(searchDto: any): Promise<Symbol[]> {
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

    return await queryBuilder.getMany();
  }
}
