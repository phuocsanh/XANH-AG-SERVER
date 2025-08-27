import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../entities/product.entity';
import { ProductType } from '../../entities/product-type.entity';
import { ProductSubtype } from '../../entities/product-subtype.entity';
import { ProductSubtypeRelation } from '../../entities/product-subtype-relation.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFactoryRegistry } from './factories/product-factory.registry';

/**
 * Service xử lý logic nghiệp vụ liên quan đến sản phẩm
 * Bao gồm quản lý sản phẩm, loại sản phẩm, loại phụ sản phẩm và mối quan hệ giữa chúng
 */
@Injectable()
export class ProductService {
  /**
   * Constructor injection các repository và service cần thiết
   * @param productRepository - Repository để thao tác với entity Product
   * @param productTypeRepository - Repository để thao tác với entity ProductType
   * @param productSubtypeRepository - Repository để thao tác với entity ProductSubtype
   * @param productSubtypeRelationRepository - Repository để thao tác với entity ProductSubtypeRelation
   * @param productFactoryRegistry - Registry quản lý các factory tạo sản phẩm
   */
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(ProductType)
    private productTypeRepository: Repository<ProductType>,
    @InjectRepository(ProductSubtype)
    private productSubtypeRepository: Repository<ProductSubtype>,
    @InjectRepository(ProductSubtypeRelation)
    private productSubtypeRelationRepository: Repository<ProductSubtypeRelation>,
    private productFactoryRegistry: ProductFactoryRegistry,
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
   * Lấy danh sách tất cả sản phẩm
   * @returns Danh sách sản phẩm
   */
  async findAll(): Promise<Product[]> {
    return this.productRepository.find();
  }

  /**
   * Tìm sản phẩm theo ID
   * @param id - ID của sản phẩm cần tìm
   * @returns Thông tin sản phẩm
   */
  async findOne(id: number): Promise<Product> {
    return this.productRepository.findOne({ where: { id } });
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
  ): Promise<Product> {
    await this.productRepository.update(id, updateProductDto);
    return this.findOne(id);
  }

  /**
   * Xóa sản phẩm theo ID
   * @param id - ID của sản phẩm cần xóa
   */
  async remove(id: number): Promise<void> {
    await this.productRepository.delete(id);
  }

  /**
   * Tìm kiếm sản phẩm theo từ khóa
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
      .orWhere('product.productSKU ILIKE :query', { query: `%${query}%` })
      .getMany();
  }

  /**
   * Tìm sản phẩm theo loại sản phẩm
   * @param productType - ID loại sản phẩm
   * @returns Danh sách sản phẩm thuộc loại đó
   */
  async findByType(productType: number): Promise<Product[]> {
    return this.productRepository.find({ where: { productType } });
  }

  // Product Type methods
  /**
   * Tạo loại sản phẩm mới
   * @param createProductTypeDto - Dữ liệu tạo loại sản phẩm mới
   * @returns Thông tin loại sản phẩm đã tạo
   */
  async createProductType(createProductTypeDto: any): Promise<ProductType> {
    const productType = new ProductType();
    Object.assign(productType, createProductTypeDto);
    const savedProductType = await this.productTypeRepository.save(productType);
    return savedProductType;
  }

  /**
   * Lấy danh sách tất cả loại sản phẩm
   * @returns Danh sách loại sản phẩm
   */
  async findAllProductTypes(): Promise<ProductType[]> {
    return this.productTypeRepository.find();
  }

  /**
   * Tìm loại sản phẩm theo ID
   * @param id - ID của loại sản phẩm cần tìm
   * @returns Thông tin loại sản phẩm
   */
  async findOneProductType(id: number): Promise<ProductType> {
    return this.productTypeRepository.findOne({ where: { id } });
  }

  /**
   * Cập nhật thông tin loại sản phẩm
   * @param id - ID của loại sản phẩm cần cập nhật
   * @param updateProductTypeDto - Dữ liệu cập nhật loại sản phẩm
   * @returns Thông tin loại sản phẩm đã cập nhật
   */
  async updateProductType(
    id: number,
    updateProductTypeDto: any,
  ): Promise<ProductType> {
    await this.productTypeRepository.update(id, updateProductTypeDto);
    return this.findOneProductType(id);
  }

  /**
   * Xóa loại sản phẩm theo ID
   * @param id - ID của loại sản phẩm cần xóa
   */
  async removeProductType(id: number): Promise<void> {
    await this.productTypeRepository.delete(id);
  }

  // Product Subtype methods
  /**
   * Tạo loại phụ sản phẩm mới
   * @param createProductSubtypeDto - Dữ liệu tạo loại phụ sản phẩm mới
   * @returns Thông tin loại phụ sản phẩm đã tạo
   */
  async createProductSubtype(
    createProductSubtypeDto: any,
  ): Promise<ProductSubtype> {
    const productSubtype = new ProductSubtype();
    Object.assign(productSubtype, createProductSubtypeDto);
    const savedProductSubtype =
      await this.productSubtypeRepository.save(productSubtype);
    return savedProductSubtype;
  }

  /**
   * Lấy danh sách tất cả loại phụ sản phẩm
   * @returns Danh sách loại phụ sản phẩm
   */
  async findAllProductSubtypes(): Promise<ProductSubtype[]> {
    return this.productSubtypeRepository.find();
  }

  /**
   * Lấy danh sách loại phụ sản phẩm theo loại sản phẩm
   * @param productTypeId - ID của loại sản phẩm
   * @returns Danh sách loại phụ sản phẩm thuộc loại sản phẩm đó
   */
  async findProductSubtypesByType(
    productTypeId: number,
  ): Promise<ProductSubtype[]> {
    return this.productSubtypeRepository.find({ where: { productTypeId } });
  }

  /**
   * Tìm loại phụ sản phẩm theo ID
   * @param id - ID của loại phụ sản phẩm cần tìm
   * @returns Thông tin loại phụ sản phẩm
   */
  async findOneProductSubtype(id: number): Promise<ProductSubtype> {
    return this.productSubtypeRepository.findOne({ where: { id } });
  }

  /**
   * Cập nhật thông tin loại phụ sản phẩm
   * @param id - ID của loại phụ sản phẩm cần cập nhật
   * @param updateProductSubtypeDto - Dữ liệu cập nhật loại phụ sản phẩm
   * @returns Thông tin loại phụ sản phẩm đã cập nhật
   */
  async updateProductSubtype(
    id: number,
    updateProductSubtypeDto: any,
  ): Promise<ProductSubtype> {
    await this.productSubtypeRepository.update(id, updateProductSubtypeDto);
    return this.findOneProductSubtype(id);
  }

  /**
   * Xóa loại phụ sản phẩm theo ID
   * @param id - ID của loại phụ sản phẩm cần xóa
   */
  async removeProductSubtype(id: number): Promise<void> {
    await this.productSubtypeRepository.delete(id);
  }

  // Product Subtype Relation methods
  /**
   * Thêm mối quan hệ loại phụ sản phẩm cho sản phẩm
   * @param productId - ID của sản phẩm
   * @param subtypeId - ID của loại phụ sản phẩm
   * @returns Thông tin mối quan hệ đã tạo
   */
  async addProductSubtypeRelation(
    productId: number,
    subtypeId: number,
  ): Promise<ProductSubtypeRelation> {
    const relation = this.productSubtypeRelationRepository.create({
      productId,
      subtypeId,
    });
    return this.productSubtypeRelationRepository.save(relation);
  }

  /**
   * Lấy danh sách mối quan hệ loại phụ sản phẩm của một sản phẩm
   * @param productId - ID của sản phẩm
   * @returns Danh sách mối quan hệ loại phụ sản phẩm
   */
  async getProductSubtypeRelations(
    productId: number,
  ): Promise<ProductSubtypeRelation[]> {
    return this.productSubtypeRelationRepository.find({ where: { productId } });
  }

  /**
   * Xóa mối quan hệ loại phụ sản phẩm của sản phẩm
   * @param productId - ID của sản phẩm
   * @param subtypeId - ID của loại phụ sản phẩm
   */
  async removeProductSubtypeRelation(
    productId: number,
    subtypeId: number,
  ): Promise<void> {
    await this.productSubtypeRelationRepository.delete({
      productId,
      subtypeId,
    });
  }

  /**
   * Xóa tất cả mối quan hệ loại phụ sản phẩm của sản phẩm
   * @param productId - ID của sản phẩm
   */
  async removeAllProductSubtypeRelations(productId: number): Promise<void> {
    await this.productSubtypeRelationRepository.delete({ productId });
  }
}
