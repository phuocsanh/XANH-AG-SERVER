import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Symbol } from '../../entities/symbols.entity';

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
}
