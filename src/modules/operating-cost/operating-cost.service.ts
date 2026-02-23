import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, Brackets } from 'typeorm';
import { OperatingCost } from '../../entities/operating-costs.entity';
import { CreateOperatingCostDto } from './dto/create-operating-cost.dto';
import { UpdateOperatingCostDto } from './dto/update-operating-cost.dto';
import { SearchOperatingCostDto } from './dto/search-operating-cost.dto';
import { QueryHelper } from '../../common/helpers/query-helper';

/**
 * Service xử lý logic nghiệp vụ liên quan đến chi phí vận hành
 */
@Injectable()
export class OperatingCostService {
  /**
   * Constructor injection repository cần thiết
   * @param operatingCostRepository - Repository để thao tác với entity OperatingCost
   */
  constructor(
    @InjectRepository(OperatingCost)
    private operatingCostRepository: Repository<OperatingCost>,
  ) {}

  /**
   * Tạo chi phí vận hành mới
   * @param createOperatingCostDto - Dữ liệu tạo chi phí vận hành mới
   * @returns Thông tin chi phí vận hành đã tạo
   */
  async create(
    createOperatingCostDto: CreateOperatingCostDto,
    queryRunner?: QueryRunner
  ): Promise<OperatingCost> {
    const repo = queryRunner ? queryRunner.manager.getRepository(OperatingCost) : this.operatingCostRepository;
    const operatingCost = repo.create(
      createOperatingCostDto,
    );
    return repo.save(operatingCost);
  }

  /**
   * Lấy danh sách tất cả chi phí vận hành
   * @returns Danh sách chi phí vận hành
   */
  async findAll(): Promise<OperatingCost[]> {
    return this.operatingCostRepository.find();
  }

  /**
   * Tìm chi phí vận hành theo ID
   * @param id - ID của chi phí vận hành cần tìm
   * @returns Thông tin chi phí vận hành hoặc null nếu không tìm thấy
   */
  async findOne(id: number): Promise<OperatingCost | null> {
    return this.operatingCostRepository.findOne({ where: { id } });
  }

  /**
   * Cập nhật thông tin chi phí vận hành
   * @param id - ID của chi phí vận hành cần cập nhật
   * @param updateOperatingCostDto - Dữ liệu cập nhật chi phí vận hành
   * @returns Thông tin chi phí vận hành đã cập nhật
   */
  async update(
    id: number,
    updateOperatingCostDto: UpdateOperatingCostDto,
  ): Promise<OperatingCost | null> {
    await this.operatingCostRepository.update(id, updateOperatingCostDto);
    return this.findOne(id);
  }

  /**
   * Xóa chi phí vận hành theo ID
   * @param id - ID của chi phí vận hành cần xóa
   */
  async remove(id: number): Promise<void> {
    await this.operatingCostRepository.delete(id);
  }

  /**
   * Lấy tổng chi phí theo loại chi phí
   * @param costType - Loại chi phí cần tính tổng
   * @returns Tổng chi phí của loại chi phí tương ứng
   */
  async getTotalCostByType(costType: string): Promise<number> {
    const result = await this.operatingCostRepository
      .createQueryBuilder('operating_cost')
      .select('SUM(operating_cost.value)', 'total')
      .where('operating_cost.type = :costType', { costType })
      .getRawOne();

    return parseFloat(result.total) || 0;
  }

  /**
   * Lấy tổng tất cả chi phí
   * @returns Tổng tất cả chi phí
   */
  async getTotalCost(): Promise<number> {
    const result = await this.operatingCostRepository
      .createQueryBuilder('operating_cost')
      .select('SUM(operating_cost.value)', 'total')
      .getRawOne();

    return parseFloat(result.total) || 0;
  }

  /**
   * Tìm kiếm chi phí vận hành nâng cao với cấu trúc filter lồng nhau
   */
  async searchOperatingCostsAdvanced(
    searchDto: SearchOperatingCostDto,
  ): Promise<{
    data: OperatingCost[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder =
      this.operatingCostRepository.createQueryBuilder('operating_cost');

    queryBuilder.leftJoinAndSelect('operating_cost.season', 'season');
    queryBuilder.leftJoinAndSelect('operating_cost.rice_crop', 'rice_crop');
    queryBuilder.leftJoinAndSelect('operating_cost.category', 'category');
    queryBuilder.leftJoinAndSelect('operating_cost.customer', 'customer');

    // 1. Base Search
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'operating_cost',
      ['name', 'description'] // Global search fields (code không có trong entity)
    );

    // 2. Simple Filters & Guest search
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'operating_cost',
      ['filters', 'nested_filters', 'operator', 'customer_name'],
      {
         season_name: 'season.name',
         rice_crop_name: 'rice_crop.field_name',
         category_name: 'category.name',
      }
    );

    // ✅ Logic tìm kiếm khách hàng (chính thức & vãng lai qua tên chi phí)
    if (searchDto.customer_name) {
      const nameKeyword = `%${QueryHelper.sanitizeKeyword(searchDto.customer_name)}%`;
      queryBuilder.andWhere(new Brackets(qb => {
        // Tìm trong bảng Customer (nếu có gán)
        qb.orWhere(`regexp_replace(unaccent(customer.name), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:nameKeyword)`, { nameKeyword });
        // Tìm trong Tên chi phí (thường lưu tên khách vãng lai khi tặng quà)
        qb.orWhere(`regexp_replace(unaccent(operating_cost.name), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:nameKeyword)`, { nameKeyword });
      }));
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
