import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductStatus } from '../../entities/products.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFactoryRegistry } from './factories/product-factory.registry';
import { FileTrackingService } from '../file-tracking/file-tracking.service';

/**
 * Service xử lý logic nghiệp vụ liên quan đến sản phẩm
 * Bao gồm quản lý sản phẩm, Status Management và Soft Delete
 */
@Injectable()
export class ProductService {
  /**
   * Constructor injection các repository và service cần thiết
   * @param productRepository - Repository để thao tác với entity Product
   * @param productFactoryRegistry - Registry quản lý các factory tạo sản phẩm
   * @param fileTrackingService - Service quản lý theo dõi file
   */
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private productFactoryRegistry: ProductFactoryRegistry,
    private fileTrackingService: FileTrackingService,
  ) {}

  /**
   * Tạo sản phẩm mới
   * @param createProductDto - Dữ liệu tạo sản phẩm mới
   * @returns Thông tin sản phẩm đã tạo
   */
  async create(createProductDto: CreateProductDto): Promise<Product> {
    // Kiểm tra xem có factory nào phù hợp với productType không
    const factory = this.productFactoryRegistry.getFactory(
      createProductDto.productType,
    );

    if (factory) {
      // Sử dụng factory để tạo product
      return factory.createProduct(createProductDto);
    } else {
      // Nếu không có factory phù hợp, tạo product theo cách thông thường
      const product = new Product();
      Object.assign(product, createProductDto);
      return this.productRepository.save(product);
    }
  }

  /**
   * Lấy danh sách tất cả sản phẩm (chỉ các bản ghi chưa bị soft delete)
   * @returns Danh sách sản phẩm
   */
  async findAll(): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .where('product.deletedAt IS NULL')
      .getMany();
  }

  /**
   * Lấy danh sách sản phẩm theo trạng thái
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @returns Danh sách sản phẩm theo trạng thái
   */
  async findByStatus(status: ProductStatus): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .where('product.status = :status', { status })
      .andWhere('product.deletedAt IS NULL')
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
      .andWhere('product.deletedAt IS NULL')
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
      product.latestPurchasePrice = latestPurchasePrice;
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
    await this.productRepository.update(id, updateProductDto);
    return this.findOne(id);
  }

  /**
   * Kích hoạt sản phẩm (chuyển trạng thái thành active)
   * @param id - ID của sản phẩm cần kích hoạt
   * @returns Thông tin sản phẩm đã kích hoạt
   */
  async activate(id: number): Promise<Product | null> {
    await this.productRepository.update(id, { status: ProductStatus.ACTIVE });
    return this.findOne(id);
  }

  /**
   * Vô hiệu hóa sản phẩm (chuyển trạng thái thành inactive)
   * @param id - ID của sản phẩm cần vô hiệu hóa
   * @returns Thông tin sản phẩm đã vô hiệu hóa
   */
  async deactivate(id: number): Promise<Product | null> {
    await this.productRepository.update(id, { status: ProductStatus.INACTIVE });
    return this.findOne(id);
  }

  /**
   * Lưu trữ sản phẩm (chuyển trạng thái thành archived)
   * @param id - ID của sản phẩm cần lưu trữ
   * @returns Thông tin sản phẩm đã lưu trữ
   */
  async archive(id: number): Promise<Product | null> {
    await this.productRepository.update(id, { status: ProductStatus.ARCHIVED });
    return this.findOne(id);
  }

  /**
   * Soft delete sản phẩm (đánh dấu deletedAt)
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
   * Tìm kiếm sản phẩm theo từ khóa (chỉ các bản ghi chưa bị soft delete)
   * @param query - Từ khóa tìm kiếm
   * @returns Danh sách sản phẩm phù hợp
   */
  async searchProducts(query: string): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .where('product.productName ILIKE :query', { query: `%${query}%` })
      .orWhere('product.productDescription ILIKE :query', {
        query: `%${query}%`,
      })
      .andWhere('product.deletedAt IS NULL')
      .getMany();
  }

  /**
   * Tìm sản phẩm theo loại sản phẩm (chỉ các bản ghi chưa bị soft delete)
   * @param productType - ID loại sản phẩm
   * @returns Danh sách sản phẩm thuộc loại đó
   */
  async findByType(productType: number): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .where('product.productType = :productType', { productType })
      .andWhere('product.deletedAt IS NULL')
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
      product.profitMarginPercent?.toString() || '15',
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
      averageCostPrice: averageCostPrice.toFixed(2),
      productPrice: productPrice.toFixed(2),
      productDiscountedPrice: productDiscountedPrice.toFixed(2),
    });

    // Trả về thông tin sản phẩm đã cập nhật
    return this.findOne(productId);
  }
}
