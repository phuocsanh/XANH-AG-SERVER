import { Injectable, Logger, Inject, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { Product } from '../../entities/products.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { BaseStatus } from '../../entities/base-status.enum';
import { FileTrackingService } from '../file-tracking/file-tracking.service';
import { SearchProductDto } from './dto/search-product.dto';
import { BaseSearchService } from '../../common/services/base-search.service';
import { PricingCalculatorUtil } from './utils/pricing-calculator.util';
import { OperatingCostService } from '../operating-cost/operating-cost.service';
import { ImageCleanupHelper } from '../../common/helpers/image-cleanup.helper';
import { UploadService } from '../upload/upload.service';
import { QueryHelper } from '../../common/helpers/query-helper';
import { ProductUnitConversionService } from '../product-unit-conversion/product-unit-conversion.service';
import { ProductComponentService } from '../product-component/product-component.service';

/**
 * Service xử lý logic nghiệp vụ liên quan đến sản phẩm
 * Bao gồm quản lý sản phẩm, Status Management và Soft Delete
 */
@Injectable()
export class ProductService extends BaseSearchService<Product> {
  private readonly logger = new Logger(ProductService.name);
  
  /**
   * Constructor injection các repository và service cần thiết
   * @param productRepository - Repository để thao tác với entity Product
   * @param fileTrackingService - Service quản lý theo dõi file
   * @param operatingCostService - Service quản lý chi phí vận hành
   * @param uploadService - Service quản lý upload và xóa file
   */
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private fileTrackingService: FileTrackingService,
    private operatingCostService: OperatingCostService,
    @Inject(UploadService)
    private uploadService: UploadService,
    private unitConversionService: ProductUnitConversionService,
    private productComponentService: ProductComponentService,
  ) {
    super();
  }

  /**
   * Tạo mã sản phẩm tự động
   * Format: SP + YYYYMMDDHHmmssSSS
   * @returns Mã sản phẩm unique
   */
  private generateProductCode(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    
    return `SP${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
  }

  /**
   * Kiểm tra trùng tên sản phẩm và tên thương mại
   * Chỉ kiểm tra với các sản phẩm chưa bị xóa mềm
   * @param name - Tên sản phẩm
   * @param tradeName - Tên thương mại
   * @param excludeId - ID sản phẩm cần loại trừ (khi update)
   * @throws ConflictException nếu tìm thấy trùng
   */
  private async checkDuplicateName(
    name: string,
    tradeName: string | undefined,
    excludeId?: number,
  ): Promise<void> {
    // Kiểm tra trùng tên sản phẩm
    const queryName = this.productRepository
      .createQueryBuilder('product')
      .where('LOWER(product.name) = LOWER(:name)', { name })
      .andWhere('product.deleted_at IS NULL');

    if (excludeId) {
      queryName.andWhere('product.id != :excludeId', { excludeId });
    }

    const existingByName = await queryName.getOne();
    if (existingByName) {
      throw new ConflictException(
        `Sản phẩm với tên "${name}" đã tồn tại. Vui lòng chọn tên khác.`,
      );
    }

    // Kiểm tra trùng tên thương mại (nếu có)
    if (tradeName) {
      const queryTradeName = this.productRepository
        .createQueryBuilder('product')
        .where('LOWER(product.trade_name) = LOWER(:tradeName)', { tradeName })
        .andWhere('product.deleted_at IS NULL');

      if (excludeId) {
        queryTradeName.andWhere('product.id != :excludeId', { excludeId });
      }

      const existingByTradeName = await queryTradeName.getOne();
      if (existingByTradeName) {
        throw new ConflictException(
          `Sản phẩm với tên thương mại "${tradeName}" đã tồn tại. Vui lòng chọn tên khác.`,
        );
      }
    }
  }

  /**
   * Tạo sản phẩm mới
   * @param createProductDto - Dữ liệu tạo sản phẩm mới
   * @returns Thông tin sản phẩm đã tạo
   */
  async create(createProductDto: CreateProductDto): Promise<Product> {
    try {
      // Kiểm tra trùng tên sản phẩm và tên thương mại
      await this.checkDuplicateName(
        createProductDto.name,
        createProductDto.trade_name,
      );

      // Tạo product mới trực tiếp, bỏ qua Factory pattern vì logic xử lý attributes đã được thống nhất
      const product = new Product();
      const { unit_conversions, ...productData } = createProductDto;
      Object.assign(product, productData);
      product.status = createProductDto.status || BaseStatus.ACTIVE;
      
      // Tự động tạo code nếu không có
      if (!product.code) {
        product.code = this.generateProductCode();
      }
      
      const savedProduct = await this.productRepository.save(product);
      const { components } = createProductDto;

      // ✅ Lưu danh sách quy đổi đơn vị tính nếu có
      if (unit_conversions && unit_conversions.length > 0) {
        await this.unitConversionService.saveAllForProduct(savedProduct.id, unit_conversions);
      }

      // ✅ Lưu danh sách thành phần (BOM) nếu có
      if (components && components.length > 0) {
        await this.productComponentService.saveAllForProduct(savedProduct.id, components);
      }

      return savedProduct;
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'sản phẩm');
    }
  }

  /**
   * Tạo sản phẩm mới với giá bán đề xuất
   * @param createProductDto - Dữ liệu tạo sản phẩm mới
   * @returns Thông tin sản phẩm đã tạo
   */
  async createWithSuggestedPrice(
    createProductDto: CreateProductDto,
  ): Promise<Product> {
    try {
      // Kiểm tra trùng tên sản phẩm và tên thương mại
      await this.checkDuplicateName(
        createProductDto.name,
        createProductDto.trade_name,
      );

      // Tạo sản phẩm
      const product = new Product();
      Object.assign(product, createProductDto);
      product.status = createProductDto.status || BaseStatus.ACTIVE;

      // Tự động tạo code nếu không có
      if (!product.code) {
        product.code = this.generateProductCode();
      }

      // Nếu không có giá bán đề xuất, tính toán dựa trên giá vốn trung bình
      if (!product.suggested_price) {
        const averageCostPrice = parseFloat(product.average_cost_price || '0');
        if (averageCostPrice > 0) {
          // Tính giá bán đề xuất
          const suggestedPrice =
            await this.calculateSuggestedPriceForNewProduct(
              averageCostPrice,
              parseFloat(product.profit_margin_percent || '10'),
            );
          product.suggested_price = suggestedPrice.toFixed(2);

          // Đặt giá bán bằng giá bán đề xuất
          product.price = product.suggested_price;
        }
      } else {
        // Nếu có giá bán đề xuất, đặt giá bán bằng giá bán đề xuất
        product.price = product.suggested_price;
      }

      // Lưu sản phẩm
      const { unit_conversions, components, ...productData } = createProductDto;
      const productToSave = new Product();
      Object.assign(productToSave, productData);
      
      // Copy calculated suggested prices back if needed
      if (product.suggested_price) productToSave.suggested_price = product.suggested_price;
      if (product.price) productToSave.price = product.price;
      productToSave.code = product.code;
      productToSave.status = product.status;

      const savedProduct = await this.productRepository.save(productToSave);

      // ✅ Lưu danh sách quy đổi đơn vị tính nếu có
      if (unit_conversions && unit_conversions.length > 0) {
        await this.unitConversionService.saveAllForProduct(savedProduct.id, unit_conversions);
      }

      // ✅ Lưu danh sách thành phần (BOM) nếu có
      if (components && components.length > 0) {
        await this.productComponentService.saveAllForProduct(savedProduct.id, components);
      }

      // Cập nhật lại giá bán đề xuất sau khi lưu
      if (!savedProduct.suggested_price) {
        await this.updateSuggestedPrice(savedProduct.id);
      }

      return savedProduct;
    } catch (error) {
      ErrorHandler.handleCreateError(error, 'sản phẩm');
    }
  }

  /**
   * Lấy danh sách tất cả sản phẩm (chỉ các bản ghi chưa bị soft delete và đang hoạt động)
   * @returns Danh sách sản phẩm
   */
  async findAll(): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.unit', 'unit')
      .leftJoinAndSelect('product.symbol', 'symbol')
      .where('product.status = :status', { status: BaseStatus.ACTIVE })
      .andWhere('product.deleted_at IS NULL')
      .getMany();
  }

  /**
   * Lấy danh sách tất cả sản phẩm (bao gồm cả không hoạt động, chỉ trừ đã xóa)
   * @returns Danh sách tất cả sản phẩm
   */
  async findAllIncludingInactive(): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .andWhere('product.deleted_at IS NULL')
      .getMany();
  }

  /**
   * Lấy danh sách sản phẩm theo trạng thái
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @returns Danh sách sản phẩm theo trạng thái
   */
  async findByStatus(status: BaseStatus): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.unit', 'unit')
      .leftJoinAndSelect('product.symbol', 'symbol')
      .where('product.status = :status', { status })
      .andWhere('product.deleted_at IS NULL')
      .getMany();
  }

  /**
   * Tìm sản phẩm theo ID (chỉ các bản ghi chưa bị soft delete)
   * @param id - ID của sản phẩm cần tìm
   * @returns Thông tin sản phẩm hoặc null nếu không tìm thấy
   */
  async findOne(id: number, queryRunner?: QueryRunner): Promise<Product | null> {
    const repo = queryRunner ? queryRunner.manager.getRepository(Product) : this.productRepository;
    return repo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.unit', 'unit')
      .leftJoinAndSelect('product.symbol', 'symbol')
      .leftJoinAndSelect('product.unit_conversions', 'unit_conversions')
      .leftJoinAndSelect('unit_conversions.unit', 'conv_unit')
      .leftJoinAndSelect('product.components', 'components')
      .leftJoinAndSelect('components.componentProduct', 'componentProduct')
      .leftJoinAndSelect('components.unit', 'comp_unit')
      .where('product.id = :id', { id })
      .andWhere('product.deleted_at IS NULL')
      .getOne();
  }

  /**
   * Lấy thông tin sản phẩm cùng với giá nhập mới nhất
   * @param id - ID của sản phẩm
   * @returns Thông tin sản phẩm cùng với giá nhập mới nhất
   */
  async findOneWithPurchaseInfo(id: number): Promise<Product | null> {
    const product = await this.findOne(id);
    if (!product) {
      return null;
    }

    // Inject thông tin giá nhập mới nhất vào sản phẩm
    // Đây là cách tiếp cận tạm thời, trong thực tế nên sử dụng một DTO riêng
    const inventoryService = (this as any).inventoryService;
    if (inventoryService) {
      const latestPurchasePrice = await inventoryService.getLatestPurchasePrice(id);
      if (latestPurchasePrice !== null) {
        product.latest_purchase_price = latestPurchasePrice.toString();
      }
    }

    return product;
  }

  /**
   * Cập nhật thông tin sản phẩm
   * @param id - ID của sản phẩm cần cập nhật
   * @param updateProductDto - Dữ liệu cập nhật sản phẩm
   * @returns Thông tin sản phẩm đã cập nhật
   */
  async update(
    id: number,
    updateProductDto: UpdateProductDto,
    queryRunner?: QueryRunner,
  ): Promise<Product | null> {
    try {
      // Lấy thông tin sản phẩm hiện tại để so sánh ảnh
      const currentProduct = await this.findOne(id, queryRunner);
      if (!currentProduct) {
        throw new Error(`Không tìm thấy sản phẩm với ID: ${id}`);
      }

      // Kiểm tra trùng tên nếu có thay đổi tên hoặc tên thương mại
      if (
        updateProductDto.name ||
        updateProductDto.trade_name !== undefined
      ) {
        await this.checkDuplicateName(
          updateProductDto.name || currentProduct.name,
          updateProductDto.trade_name !== undefined
            ? updateProductDto.trade_name
            : currentProduct.trade_name,
          id, // Loại trừ sản phẩm hiện tại khi kiểm tra
        );
      }

      // Cập nhật sản phẩm
      const repo = queryRunner ? queryRunner.manager.getRepository(Product) : this.productRepository;
      const { unit_conversions, components, ...productUpdateData } = updateProductDto;
      await repo.update(id, productUpdateData);

      // ✅ Cập nhật danh sách quy đổi đơn vị tính nếu có
      if (unit_conversions) {
        await this.unitConversionService.saveAllForProduct(id, unit_conversions, queryRunner);
      }

      // ✅ Cập nhật danh sách thành phần (BOM) nếu có
      if (components) {
        await this.productComponentService.saveAllForProduct(id, components, queryRunner);
      }

      // Xử lý xóa ảnh cũ nếu có thay đổi
      await this.cleanupOldImages(currentProduct, updateProductDto);

      return this.findOne(id, queryRunner);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'sản phẩm');
    }
  }

  /**
   * Xóa các ảnh cũ không còn được sử dụng sau khi update
   * @param currentProduct - Sản phẩm hiện tại (trước khi update)
   * @param updateDto - Dữ liệu update mới
   */
  private async cleanupOldImages(
    currentProduct: Product,
    updateDto: UpdateProductDto,
  ): Promise<void> {
    // Xóa thumb cũ nếu có thay đổi
    await ImageCleanupHelper.cleanupSingleImage(
      currentProduct.thumb,
      updateDto.thumb,
      this.uploadService,
    );

    // Xóa pictures cũ nếu có thay đổi
    await ImageCleanupHelper.cleanupArrayImages(
      currentProduct.pictures,
      updateDto.pictures,
      this.uploadService,
    );

    // Xóa videos cũ nếu có thay đổi
    await ImageCleanupHelper.cleanupArrayImages(
      currentProduct.videos,
      updateDto.videos,
      this.uploadService,
    );
  }

  /**
   * Kích hoạt sản phẩm (chuyển trạng thái thành active)
   * @param id - ID của sản phẩm cần kích hoạt
   * @returns Thông tin sản phẩm đã kích hoạt
   */
  async activate(id: number): Promise<Product | null> {
    await this.productRepository.update(id, { status: BaseStatus.ACTIVE });
    return this.findOne(id);
  }

  /**
   * Vô hiệu hóa sản phẩm (chuyển trạng thái thành inactive)
   * @param id - ID của sản phẩm cần vô hiệu hóa
   * @returns Thông tin sản phẩm đã vô hiệu hóa
   */
  async deactivate(id: number): Promise<Product | null> {
    await this.productRepository.update(id, { status: BaseStatus.INACTIVE });
    return this.findOne(id);
  }

  /**
   * Lưu trữ sản phẩm (chuyển trạng thái thành archived)
   * @param id - ID của sản phẩm cần lưu trữ
   * @returns Thông tin sản phẩm đã lưu trữ
   */
  async archive(id: number): Promise<Product | null> {
    await this.productRepository.update(id, { status: BaseStatus.ARCHIVED });
    return this.findOne(id);
  }

  /**
   * Soft delete sản phẩm (đánh dấu deleted_at)
   * @param id - ID của sản phẩm cần soft delete
   */
  async softDelete(id: number): Promise<void> {
    await this.productRepository.softDelete(id);
  }

  /**
   * Khôi phục sản phẩm đã bị soft delete
   * @param id - ID của sản phẩm cần khôi phục
   * @returns Thông tin sản phẩm đã khôi phục
   */
  async restore(id: number): Promise<Product | null> {
    await this.productRepository.restore(id);
    return this.productRepository.findOne({ where: { id } });
  }

  /**
   * Xóa cứng sản phẩm theo ID (hard delete)
   * @param id - ID của sản phẩm cần xóa
   */
  async remove(id: number): Promise<void> {
    // Xóa tất cả file references liên quan đến sản phẩm trước khi xóa sản phẩm
    await this.fileTrackingService.batchRemoveEntityFileReferences(
      'Product',
      id,
    );

    // Xóa sản phẩm
    await this.productRepository.delete(id);
  }

  /**
   * Tìm kiếm sản phẩm theo từ khóa (chỉ các bản ghi chưa bị soft delete và đang hoạt động)
   * @param query - Từ khóa tìm kiếm
   * @returns Danh sách sản phẩm phù hợp
   */
  async searchProducts(query: string): Promise<Product[]> {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.unit', 'unit')
      .leftJoinAndSelect('product.symbol', 'symbol');

    const condName = QueryHelper.applyFuzzyCondition(queryBuilder, 'product.name', query, 'q_name');
    const condTrade = QueryHelper.applyFuzzyCondition(queryBuilder, 'product.trade_name', query, 'q_trade');
    const condDesc = QueryHelper.applyFuzzyCondition(queryBuilder, 'product.description', query, 'q_desc');

    return queryBuilder
      .where(`(${condName} OR ${condTrade} OR product.code ILIKE :query OR ${condDesc})`, { query: `%${query}%` })
      .andWhere('product.status = :status', { status: BaseStatus.ACTIVE })
      .andWhere('product.deleted_at IS NULL')
      .getMany();
  }

  /**
   * Tìm kiếm sản phẩm nâng cao với cấu trúc filter lồng nhau
   * @param searchDto - Điều kiện tìm kiếm
   * @returns Danh sách sản phẩm phù hợp
   */
  async searchProductsAdvanced(
    searchDto: SearchProductDto,
  ): Promise<{ data: Product[]; total: number; page: number; limit: number }> {
    const queryBuilder = this.productRepository.createQueryBuilder('product');

    queryBuilder.leftJoinAndSelect('product.unit', 'unit');
    queryBuilder.leftJoinAndSelect('product.symbol', 'symbol');
    queryBuilder.leftJoinAndSelect('product.unit_conversions', 'unit_conversions');
    queryBuilder.leftJoinAndSelect('unit_conversions.unit', 'conv_unit');

    // 1. Base Search & Pagination
    const { page, limit } = QueryHelper.applyBaseSearch(
      queryBuilder,
      searchDto,
      'product',
      ['name', 'code', 'trade_name', 'notes'] // Tìm kiếm theo tên, hiệu thuốc, mã sản phẩm và ghi chú
    );

    // Fix: Handle sorting for price fields (stored as string in DB)
    const sortField = searchDto.sort
      ? searchDto.sort.split(':')[0]
      : searchDto.sort_by;
    if (
      sortField &&
      ['price', 'credit_price', 'suggested_price', 'discounted_price', 'average_cost_price'].includes(
        sortField,
      )
    ) {
      const sortOrder = searchDto.sort
        ? ((searchDto.sort.split(':')[1] || 'DESC').toUpperCase() as
            | 'ASC'
            | 'DESC')
        : searchDto.sort_order || 'DESC';

      queryBuilder.addSelect(
        `CAST(product.${sortField} AS DECIMAL)`,
        'sort_numeric_value',
      );
      queryBuilder.orderBy('sort_numeric_value', sortOrder);
    }

    // 2. Simple Filters (code, name, status...)
    // 2. Simple Filters (code, name, status...)
    QueryHelper.applyFilters(
      queryBuilder,
      searchDto,
      'product',
      ['filters', 'nested_filters', 'operator', 'type_id'],
      {
         unit_name: 'unit.name',
         symbol_name: 'symbol.name',
      }
    );

    if (searchDto.type_id) {
      queryBuilder.andWhere('product.type = :typeId', {
        typeId: searchDto.type_id,
      });
    }

    if (!searchDto.status) {
       queryBuilder.andWhere('product.status = :activeStatus', { activeStatus: BaseStatus.ACTIVE });
    }
    queryBuilder.andWhere('product.deleted_at IS NULL');

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Tìm sản phẩm theo loại sản phẩm (chỉ các bản ghi chưa bị soft delete và đang hoạt động)
   * @param productType - ID loại sản phẩm
   * @returns Danh sách sản phẩm thuộc loại đó
   */
  async findByType(productType: number): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.unit', 'unit')
      .leftJoinAndSelect('product.symbol', 'symbol')
      .where('product.type = :productType', { productType })
      .andWhere('product.status = :status', { status: BaseStatus.ACTIVE })
      .andWhere('product.deleted_at IS NULL')
      .getMany();
  }

  /**
   * Cập nhật giá vốn trung bình và giá bán sản phẩm dựa trên phần trăm lợi nhuận
   * Tương tự như phương thức UpdateProductAverageCostAndPrice trong Go server
   * @param productId - ID của sản phẩm cần cập nhật
   * @param averageCostPrice - Giá vốn trung bình mới
   * @returns Thông tin sản phẩm đã cập nhật
   */
  async updateProductAverageCostAndPrice(
    productId: number,
    averageCostPrice: number,
    queryRunner?: QueryRunner,
  ): Promise<Product | null> {
    // Lấy thông tin sản phẩm hiện tại để có phần trăm lợi nhuận và discount
    const product = await this.findOne(productId, queryRunner);
    if (!product) {
      throw new Error(`Không tìm thấy sản phẩm với ID: ${productId}`);
    }

    // Lấy phần trăm lợi nhuận (mặc định 15% nếu không có)
    const profitMarginPercent = parseFloat(
      product.profit_margin_percent?.toString() || '15',
    );

    // Lấy phần trăm giảm giá (mặc định 0% nếu không có)
    const discount = parseFloat(product.discount?.toString() || '0');

    // Tính giá bán dựa trên giá vốn và phần trăm lợi nhuận
    // product_price = average_cost_price * (1 + profit_margin_percent / 100)
    const productPrice = averageCostPrice * (1 + profitMarginPercent / 100);

    // Tính giá bán sau giảm giá
    // product_discounted_price = product_price * (1 - discount / 100)
    const productDiscountedPrice = productPrice * (1 - discount / 100);

    // Cập nhật sản phẩm với giá vốn trung bình và giá bán mới
    await this.productRepository.update(productId, {
      average_cost_price: averageCostPrice.toFixed(2),
      price: productPrice.toFixed(2),
      discounted_price: productDiscountedPrice.toFixed(2),
    });

    // Trả về thông tin sản phẩm đã cập nhật
    return this.findOne(productId);
  }

  /**
   * Tính tổng giá trị hàng tồn kho
   * @returns Tổng giá trị hàng tồn kho
   */
  async calculateTotalInventoryValue(): Promise<number> {
    const products = await this.findAll();
    let totalValue = 0;

    for (const product of products) {
      const quantity = product.quantity || 0;
      const averageCostPrice = parseFloat(product.average_cost_price || '0');
      totalValue += quantity * averageCostPrice;
    }

    return totalValue;
  }

  /**
   * Tính tỷ lệ phân bổ chi phí gián tiếp
   * @returns Tỷ lệ phân bổ chi phí gián tiếp
   */
  async calculateIndirectCostAllocationRate(): Promise<number> {
    // Lấy tổng chi phí gián tiếp
    const totalIndirectCosts = await this.operatingCostService.getTotalCost();

    // Lấy tổng giá trị hàng tồn kho
    const totalInventoryValue = await this.calculateTotalInventoryValue();

    if (totalInventoryValue <= 0) {
      return 0;
    }

    return totalIndirectCosts / totalInventoryValue;
  }

  /**
   * Tính chi phí gián tiếp phân bổ cho một sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Chi phí gián tiếp phân bổ cho sản phẩm
   */
  async calculateProductIndirectCost(productId: number): Promise<number> {
    const product = await this.findOne(productId);
    if (!product) {
      throw new Error(`Không tìm thấy sản phẩm với ID: ${productId}`);
    }

    const quantity = product.quantity || 0;
    const averageCostPrice = parseFloat(product.average_cost_price || '0');
    const productValue = quantity * averageCostPrice;

    const allocationRate = await this.calculateIndirectCostAllocationRate();
    return productValue * allocationRate;
  }

  /**
   * Tính giá bán đề xuất cho sản phẩm
   * @param productId - ID của sản phẩm
   * @param desiredProfitMargin - Tỷ lệ lợi nhuận mong muốn (mặc định lấy từ sản phẩm, nếu không có thì 10%)
   * @param taxRate - Tỷ lệ thuế (mặc định 1.5%)
   * @returns Giá bán đề xuất
   */
  async calculateSuggestedPrice(
    productId: number,
    desiredProfitMargin?: number,
    taxRate: number = 1.5,
  ): Promise<number> {
    const product = await this.findOne(productId);
    if (!product) {
      throw new Error(`Không tìm thấy sản phẩm với ID: ${productId}`);
    }

    // Nếu không có tham số desiredProfitMargin, lấy từ sản phẩm (mặc định 10% nếu không có)
    const profitMargin =
      desiredProfitMargin !== undefined
        ? desiredProfitMargin
        : parseFloat(product.profit_margin_percent?.toString() || '10');

    // Tính chi phí trực tiếp
    const directCost = parseFloat(product.average_cost_price || '0');

    // Tính chi phí gián tiếp phân bổ
    const indirectCost = await this.calculateProductIndirectCost(productId);

    // Tính tổng chi phí
    const totalCost = directCost + indirectCost;

    // Tính giá bán trước thuế
    const priceBeforeTax = PricingCalculatorUtil.calculateSellingPrice(
      totalCost,
      profitMargin,
    );

    // Tính giá bán sau thuế
    const suggestedPrice = PricingCalculatorUtil.calculatePriceWithTax(
      priceBeforeTax,
      taxRate,
    );

    return suggestedPrice;
  }

  /**
   * Cập nhật giá bán đề xuất cho sản phẩm
   * @param productId - ID của sản phẩm
   * @param desiredProfitMargin - Tỷ lệ lợi nhuận mong muốn (tùy chọn)
   * @returns Thông tin sản phẩm đã cập nhật
   */
  async updateSuggestedPrice(
    productId: number,
    desiredProfitMargin?: number,
  ): Promise<Product | null> {
    const suggestedPrice = await this.calculateSuggestedPrice(
      productId,
      desiredProfitMargin,
    );

    // Cập nhật giá bán đề xuất trong cơ sở dữ liệu
    await this.productRepository.update(productId, {
      suggested_price: suggestedPrice.toFixed(2),
    });

    return this.findOne(productId);
  }

  /**
   * Cập nhật giá bán đề xuất cho tất cả sản phẩm
   * @param desiredProfitMargin - Tỷ lệ lợi nhuận mong muốn (tùy chọn)
   */
  async updateAllSuggestedPrices(desiredProfitMargin?: number): Promise<void> {
    const products = await this.findAll();

    for (const product of products) {
      try {
        await this.updateSuggestedPrice(product.id, desiredProfitMargin);
      } catch (error) {
        this.logger.error(
          `Lỗi khi cập nhật giá bán đề xuất cho sản phẩm ID ${product.id}:`,
          error,
        );
        // Tiếp tục với sản phẩm tiếp theo thay vì dừng toàn bộ quá trình
      }
    }
  }

  /**
   * Tính giá bán đề xuất cho sản phẩm mới
   * @param averageCostPrice - Giá vốn trung bình
   * @param profitMarginPercent - Tỷ lệ lợi nhuận
   * @returns Giá bán đề xuất
   */
  async calculateSuggestedPriceForNewProduct(
    averageCostPrice: number,
    profitMarginPercent: number,
  ): Promise<number> {
    // Tính giá bán trước thuế
    const priceBeforeTax = averageCostPrice * (1 + profitMarginPercent / 100);

    // Tính giá bán sau thuế 1.5%
    const suggestedPrice = priceBeforeTax / (1 - 0.015);

    return suggestedPrice;
  }
}
