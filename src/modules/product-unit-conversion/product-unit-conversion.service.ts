import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { ProductUnitConversion } from '../../entities/product-unit-conversions.entity';
import {
  CreateProductUnitConversionDto,
  UpdateProductUnitConversionDto,
} from './dto/create-product-unit-conversion.dto';

/**
 * Service xử lý nghiệp vụ quản lý bảng quy đổi đơn vị tính sản phẩm.
 * Cho phép định nghĩa: 1 BAO = 50 KG, 1 TẠ = 100 KG, v.v.
 */
@Injectable()
export class ProductUnitConversionService {
  private readonly logger = new Logger(ProductUnitConversionService.name);

  constructor(
    @InjectRepository(ProductUnitConversion)
    private conversionRepository: Repository<ProductUnitConversion>,
  ) {}

  /**
   * Lấy tất cả quy đổi đơn vị của một sản phẩm (sắp xếp theo sort_order).
   * @param productId - ID sản phẩm
   */
  async findByProduct(productId: number): Promise<ProductUnitConversion[]> {
    return this.conversionRepository.find({
      where: { product_id: productId },
      relations: ['unit'],
      order: { sort_order: 'ASC', id: 'ASC' },
    });
  }

  /**
   * Lấy đơn vị cơ sở của sản phẩm (is_base_unit = true).
   * @param productId - ID sản phẩm
   */
  async getBaseUnit(
    productId: number,
    queryRunner?: QueryRunner,
  ): Promise<ProductUnitConversion | null> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(ProductUnitConversion)
      : this.conversionRepository;

    return repo.findOne({
      where: { product_id: productId, is_base_unit: true },
      relations: ['unit'],
    });
  }

  /**
   * Lấy hệ số quy đổi giữa một đơn vị cụ thể và đơn vị cơ sở.
   * Trả về 1 nếu không tìm thấy cấu hình (tương thích ngược).
   * @param productId - ID sản phẩm
   * @param unitId - ID đơn vị cần quy đổi
   */
  async getConversionFactor(
    productId: number,
    unitId: number,
  ): Promise<number> {
    if (!unitId) return 1;

    const conversion = await this.conversionRepository.findOne({
      where: { product_id: productId, unit_id: unitId },
    });

    // Nếu không có cấu hình, mặc định factor = 1 (không đổi) để tương thích ngược
    return conversion ? Number(conversion.conversion_factor) : 1;
  }

  /**
   * Tính số lượng quy về đơn vị cơ sở.
   * Dùng khi nhập kho hoặc bán hàng để tính base_quantity.
   * @param productId - ID sản phẩm
   * @param quantity - Số lượng theo đơn vị bán/nhập
   * @param unitId - ID đơn vị bán/nhập (BAO, KG...)
   */
  async calculateBaseQuantity(
    productId: number,
    quantity: number,
    unitId?: number,
  ): Promise<{ baseQuantity: number; conversionFactor: number }> {
    const factor = unitId
      ? await this.getConversionFactor(productId, unitId)
      : 1;
    return {
      baseQuantity: quantity * factor,
      conversionFactor: factor,
    };
  }

  /**
   * Tính số lượng từ đơn vị cơ sở về đơn vị hiển thị.
   * Dùng để hiển thị tồn kho theo đơn vị (BAO, TẠ...).
   * @param baseQuantity - Số lượng theo đơn vị cơ sở (KG)
   * @param productId - ID sản phẩm
   * @param unitId - ID đơn vị cần quy đổi về
   */
  async convertFromBase(
    baseQuantity: number,
    productId: number,
    unitId: number,
  ): Promise<number> {
    const factor = await this.getConversionFactor(productId, unitId);
    return factor > 0 ? baseQuantity / factor : baseQuantity;
  }

  /**
   * Tạo mới một quy đổi đơn vị.
   * @param dto - Dữ liệu tạo mới
   */
  async create(
    dto: CreateProductUnitConversionDto,
  ): Promise<ProductUnitConversion> {
    if (!dto.product_id) {
      throw new BadRequestException('ID sản phẩm là bắt buộc.');
    }

    // Kiểm tra trùng lặp (cùng product + unit)
    const existing = await this.conversionRepository.findOne({
      where: { product_id: dto.product_id, unit_id: dto.unit_id },
    });
    if (existing) {
      throw new BadRequestException(
        `Đơn vị quy đổi này đã tồn tại cho sản phẩm. Hãy cập nhật thay vì tạo mới.`,
      );
    }

    // Nếu đây là đơn vị cơ sở mới, hủy trạng thái cơ sở của đơn vị cũ
    if (dto.is_base_unit) {
      await this.conversionRepository.update(
        { product_id: dto.product_id, is_base_unit: true },
        { is_base_unit: false },
      );
    }

    const entity = this.conversionRepository.create(dto);
    return this.conversionRepository.save(entity);
  }

  /**
   * Cập nhật một quy đổi đơn vị theo ID.
   * @param id - ID cần cập nhật
   * @param dto - Dữ liệu cập nhật
   */
  async update(
    id: number,
    dto: UpdateProductUnitConversionDto,
  ): Promise<ProductUnitConversion> {
    const entity = await this.conversionRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Không tìm thấy quy đổi đơn vị ID ${id}`);
    }

    // Nếu đây là đơn vị cơ sở mới, hủy trạng thái cơ sở của đơn vị cũ
    if (dto.is_base_unit) {
      await this.conversionRepository.update(
        { product_id: entity.product_id, is_base_unit: true },
        { is_base_unit: false },
      );
    }

    Object.assign(entity, dto);
    return this.conversionRepository.save(entity);
  }

  /**
   * Xóa một quy đổi đơn vị theo ID.
   * @param id - ID cần xóa
   */
  async remove(id: number): Promise<void> {
    const entity = await this.conversionRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Không tìm thấy quy đổi đơn vị ID ${id}`);
    }
    if (entity.is_base_unit) {
      throw new BadRequestException(
        'Không thể xóa đơn vị cơ sở. Hãy đặt đơn vị khác làm cơ sở trước.',
      );
    }
    await this.conversionRepository.delete(id);
  }

  /**
   * Lưu toàn bộ danh sách quy đổi cho 1 sản phẩm (xóa cũ, tạo mới).
   * Dùng để save từ form sản phẩm.
   * @param productId - ID sản phẩm
   * @param items - Danh sách quy đổi mới
   */
  async saveAllForProduct(
    productId: number,
    items: CreateProductUnitConversionDto[],
    queryRunner?: QueryRunner,
  ): Promise<ProductUnitConversion[]> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(ProductUnitConversion)
      : this.conversionRepository;

    // Validate: phải có đúng 1 đơn vị cơ sở
    const baseUnits = items.filter((i) => i.is_base_unit);
    if (baseUnits.length === 0 && items.length > 0) {
      throw new BadRequestException(
        'Phải có ít nhất 1 đơn vị cơ sở (is_base_unit = true).',
      );
    }
    if (baseUnits.length > 1) {
      throw new BadRequestException('Chỉ được phép có 1 đơn vị cơ sở.');
    }

    // Validate: đơn vị cơ sở phải có factor = 1
    const baseUnit = baseUnits[0];
    if (baseUnit) {
      // Đảm bảo đơn vị cơ sở luôn có hệ số = 1, không cho phép sai lệch
      baseUnit.conversion_factor = 1;
    }

    // Xóa tất cả quy đổi cũ của sản phẩm
    await repo.delete({ product_id: productId });

    if (items.length === 0) return [];

    // Tạo các quy đổi mới
    const entities = items.map((item) =>
      repo.create({ ...item, product_id: productId }),
    );

    const saved = await repo.save(entities);
    this.logger.log(
      `✅ Đã lưu ${saved.length} quy đổi đơn vị cho sản phẩm #${productId}`,
    );
    return saved;
  }

  /**
   * Lấy thông tin quy đổi đầy đủ cho một sản phẩm để dùng khi nhập/xuất kho.
   * Trả về map: unitId → conversionFactor
   * @param productId - ID sản phẩm
   */
  async getConversionMap(productId: number): Promise<Map<number, number>> {
    const conversions = await this.findByProduct(productId);
    const map = new Map<number, number>();
    conversions.forEach((c) => map.set(c.unit_id, Number(c.conversion_factor)));
    return map;
  }
}
