import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../entities/products.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ErrorHandler } from '../../common/helpers/error-handler.helper';
import { BaseStatus } from '../../entities/base-status.enum';
import { ProductFactoryRegistry } from './factories/product-factory.registry';
import { FileTrackingService } from '../file-tracking/file-tracking.service';
import { SearchProductDto } from './dto/search-product.dto';
import { BaseSearchService } from '../../common/services/base-search.service';
import { PricingCalculatorUtil } from './utils/pricing-calculator.util';
import { OperatingCostService } from '../operating-cost/operating-cost.service';

/**
 * Service xử lý logic nghiệp vụ liên quan đến sản phẩm
 * Bao gồm quản lý sản phẩm, Status Management và Soft Delete
 */
@Injectable()
export class ProductService extends BaseSearchService<Product> {
  /**
   * Constructor injection các repository và service cần thiết
   * @param productRepository - Repository để thao tác với entity Product
   * @param productFactoryRegistry - Registry quản lý các factory tạo sản phẩm
   * @param fileTrackingService - Service quản lý theo dõi file
   * @param operatingCostService - Service quản lý chi phí vận hành
   */
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private productFactoryRegistry: ProductFactoryRegistry,
    private fileTrackingService: FileTrackingService,
    private operatingCostService: OperatingCostService,
  ) {
    super();
  }

  /**
   * Tạo sản phẩm mới
   * @param createProductDto - Dữ liệu tạo sản phẩm mới
   * @returns Thông tin sản phẩm đã tạo
   */
  async create(createProductDto: CreateProductDto): Promise<Product> {
    try {
      // Kiểm tra xem có factory nào phù hợp với productType không
      const factory = this.productFactoryRegistry.getFactory(
        createProductDto.type,
      );

      if (factory) {
        // Sử dụng factory để tạo product
        return factory.createProduct(createProductDto);
      } else {
        // Nếu không có factory phù hợp, tạo product theo cách thông thường
        const product = new Product();
        Object.assign(product, createProductDto);
        product.status = createProductDto.status || BaseStatus.ACTIVE;
        return this.productRepository.save(product);
      }
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
      // Tạo sản phẩm
      const product = new Product();
      Object.assign(product, createProductDto);
      product.status = createProductDto.status || BaseStatus.ACTIVE;

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
      const savedProduct = await this.productRepository.save(product);

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
      .where('product.status = :status', { status: BaseStatus.ACTIVE })
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
      .where('product.status = :status', { status })
      .andWhere('product.deleted_at IS NULL')
      .getMany();
  }

  /**
   * Tìm sản phẩm theo ID (chỉ các bản ghi chưa bị soft delete)
   * @param id - ID của sản phẩm cần tìm
   * @returns Thông tin sản phẩm hoặc null nếu không tìm thấy
   */
  async findOne(id: number): Promise<Product | null> {
    return this.productRepository
      .createQueryBuilder('product')
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
      const latestPurchasePrice =
        await inventoryService.getLatestPurchasePrice(id);
      product.latest_purchase_price = latestPurchasePrice;
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
  ): Promise<Product | null> {
    try {
      await this.productRepository.update(id, updateProductDto);
      return this.findOne(id);
    } catch (error) {
      ErrorHandler.handleUpdateError(error, 'sản phẩm');
    }
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
    return this.productRepository
      .createQueryBuilder('product')
      .where('product.name ILIKE :query', { query: `%${query}%` })
      .orWhere('product.description ILIKE :query', {
        query: `%${query}%`,
      })
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

    // Kiểm tra xem có filter deleted_at không
    const hasDeletedFilter = searchDto.filters?.some(
      (filter) => filter.field === 'deleted_at',
    );

    // Thêm điều kiện mặc định chỉ khi không có filter deleted_at
    if (!hasDeletedFilter) {
      queryBuilder
        .where('product.status = :status', { status: BaseStatus.ACTIVE })
        .andWhere('product.deleted_at IS NULL');
    } else {
      // Nếu có filter deleted_at, cần sử dụng withDeleted() để bao gồm các bản ghi đã xóa
      queryBuilder.withDeleted();

      // Kiểm tra xem filter deleted_at có giá trị là isnotnull không
      const deletedFilter = searchDto.filters?.find(
        (filter) => filter.field === 'deleted_at',
      );

      if (deletedFilter && deletedFilter.operator === 'isnotnull') {
        // Nếu đang tìm kiếm các bản ghi đã xóa, chỉ hiển thị các bản ghi có deleted_at IS NOT NULL
        queryBuilder.where('product.deleted_at IS NOT NULL');
      } else if (deletedFilter && deletedFilter.operator === 'isnull') {
        // Nếu đang tìm kiếm các bản ghi chưa xóa, thêm điều kiện này
        queryBuilder.where('product.deleted_at IS NULL');
      }

      // Luôn thêm điều kiện status nếu không có filter status
      const hasStatusFilter = searchDto.filters?.some(
        (filter) => filter.field === 'status',
      );

      if (!hasStatusFilter) {
        queryBuilder.andWhere('product.status = :status', {
          status: BaseStatus.ACTIVE,
        });
      }
    }

    // Tạo một bản sao sâu của searchDto để tránh thay đổi dữ liệu gốc
    const searchDtoCopy = JSON.parse(JSON.stringify(searchDto));

    // Xây dựng điều kiện tìm kiếm
    this.buildSearchConditions(queryBuilder, searchDtoCopy, 'product');

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
   * Tìm sản phẩm theo loại sản phẩm (chỉ các bản ghi chưa bị soft delete và đang hoạt động)
   * @param productType - ID loại sản phẩm
   * @returns Danh sách sản phẩm thuộc loại đó
   */
  async findByType(productType: number): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .where('product.productType = :productType', { productType })
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
  ): Promise<Product | null> {
    // Lấy thông tin sản phẩm hiện tại để có phần trăm lợi nhuận và discount
    const product = await this.findOne(productId);
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
   * @param desiredProfitMargin - Tỷ lệ lợi nhuận mong muốn (mặc định 10%)
   * @param taxRate - Tỷ lệ thuế (mặc định 1.5%)
   * @returns Giá bán đề xuất
   */
  async calculateSuggestedPrice(
    productId: number,
    desiredProfitMargin: number = 10,
    taxRate: number = 1.5,
  ): Promise<number> {
    const product = await this.findOne(productId);
    if (!product) {
      throw new Error(`Không tìm thấy sản phẩm với ID: ${productId}`);
    }

    // Tính chi phí trực tiếp
    const directCost = parseFloat(product.average_cost_price || '0');

    // Tính chi phí gián tiếp phân bổ
    const indirectCost = await this.calculateProductIndirectCost(productId);

    // Tính tổng chi phí
    const totalCost = directCost + indirectCost;

    // Tính giá bán trước thuế
    const priceBeforeTax = PricingCalculatorUtil.calculateSellingPrice(
      totalCost,
      desiredProfitMargin,
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
   * @returns Thông tin sản phẩm đã cập nhật
   */
  async updateSuggestedPrice(productId: number): Promise<Product | null> {
    const suggestedPrice = await this.calculateSuggestedPrice(productId);

    // Cập nhật giá bán đề xuất trong cơ sở dữ liệu
    await this.productRepository.update(productId, {
      suggested_price: suggestedPrice.toFixed(2),
    });

    return this.findOne(productId);
  }

  /**
   * Cập nhật giá bán đề xuất cho tất cả sản phẩm
   */
  async updateAllSuggestedPrices(): Promise<void> {
    const products = await this.findAll();

    for (const product of products) {
      try {
        await this.updateSuggestedPrice(product.id);
      } catch (error) {
        console.error(
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
