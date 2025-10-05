import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductType, ProductTypeStatus } from '../../entities/product-types.entity';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';
import { FileTrackingService } from '../file-tracking/file-tracking.service';

/**
 * Service xử lý logic nghiệp vụ liên quan đến loại sản phẩm
 * Bao gồm các thao tác CRUD, Status Management và Soft Delete cho ProductType
 */
@Injectable()
export class ProductTypeService {
  /**
   * Constructor injection các repository và service cần thiết
   * @param productTypeRepository - Repository để thao tác với entity ProductType
   * @param fileTrackingService - Service quản lý theo dõi file
   */
  constructor(
    @InjectRepository(ProductType)
    private productTypeRepository: Repository<ProductType>,
    private fileTrackingService: FileTrackingService,
  ) {}

  /**
   * Tạo loại sản phẩm mới
   * @param createProductTypeDto - Dữ liệu tạo loại sản phẩm mới
   * @returns Thông tin loại sản phẩm đã tạo
   */
  async create(createProductTypeDto: CreateProductTypeDto): Promise<ProductType> {
    const productType = new ProductType();
    Object.assign(productType, createProductTypeDto);
    const savedProductType = await this.productTypeRepository.save(productType);
    return savedProductType;
  }

  /**
   * Lấy danh sách tất cả loại sản phẩm (chỉ các bản ghi chưa bị soft delete)
   * @returns Danh sách loại sản phẩm
   */
  async findAll(): Promise<ProductType[]> {
    return this.productTypeRepository.createQueryBuilder('productType')
      .where('productType.deletedAt IS NULL')
      .getMany();
  }

  /**
   * Lấy danh sách loại sản phẩm theo trạng thái
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @returns Danh sách loại sản phẩm theo trạng thái
   */
  async findByStatus(status: ProductTypeStatus): Promise<ProductType[]> {
    return this.productTypeRepository.createQueryBuilder('productType')
      .where('productType.status = :status', { status })
      .andWhere('productType.deletedAt IS NULL')
      .getMany();
  }

  /**
   * Tìm loại sản phẩm theo ID (chỉ các bản ghi chưa bị soft delete)
   * @param id - ID của loại sản phẩm cần tìm
   * @returns Thông tin loại sản phẩm hoặc null nếu không tìm thấy
   */
  async findOne(id: number): Promise<ProductType | null> {
    return this.productTypeRepository.createQueryBuilder('productType')
      .where('productType.id = :id', { id })
      .andWhere('productType.deletedAt IS NULL')
      .getOne();
  }

  /**
   * Cập nhật thông tin loại sản phẩm chỉ sử dụng status
   * @param id - ID của loại sản phẩm cần cập nhật
   * @param updateProductTypeDto - Dữ liệu cập nhật loại sản phẩm
   * @returns Thông tin loại sản phẩm đã cập nhật
   */
  async update(
    id: number,
    updateProductTypeDto: UpdateProductTypeDto,
  ): Promise<ProductType | null> {
    await this.productTypeRepository.update(id, updateProductTypeDto);
    return this.findOne(id);
  }

  /**
   * Kích hoạt loại sản phẩm (chuyển trạng thái thành active)
   * @param id - ID của loại sản phẩm cần kích hoạt
   * @returns Thông tin loại sản phẩm đã kích hoạt
   */
  async activate(id: number): Promise<ProductType | null> {
    await this.productTypeRepository.update(id, {
      status: ProductTypeStatus.ACTIVE,
    });
    return this.findOne(id);
  }

  /**
   * Vô hiệu hóa loại sản phẩm (chuyển trạng thái thành inactive)
   * @param id - ID của loại sản phẩm cần vô hiệu hóa
   * @returns Thông tin loại sản phẩm đã vô hiệu hóa
   */
  async deactivate(id: number): Promise<ProductType | null> {
    await this.productTypeRepository.update(id, {
      status: ProductTypeStatus.INACTIVE,
    });
    return this.findOne(id);
  }

  /**
   * Lưu trữ loại sản phẩm (chuyển trạng thái thành archived)
   * @param id - ID của loại sản phẩm cần lưu trữ
   * @returns Thông tin loại sản phẩm đã lưu trữ
   */
  async archive(id: number): Promise<ProductType | null> {
    await this.productTypeRepository.update(id, {
      status: ProductTypeStatus.ARCHIVED,
    });
    return this.findOne(id);
  }

  /**
   * Soft delete loại sản phẩm (đánh dấu deletedAt)
   * @param id - ID của loại sản phẩm cần soft delete
   */
  async softDelete(id: number): Promise<void> {
    await this.productTypeRepository.softDelete(id);
  }

  /**
   * Khôi phục loại sản phẩm đã bị soft delete
   * @param id - ID của loại sản phẩm cần khôi phục
   * @returns Thông tin loại sản phẩm đã khôi phục
   */
  async restore(id: number): Promise<ProductType | null> {
    await this.productTypeRepository.restore(id);
    return this.productTypeRepository.findOne({ where: { id } });
  }

  /**
   * Xóa vĩnh viễn loại sản phẩm theo ID (hard delete)
   * @param id - ID của loại sản phẩm cần xóa vĩnh viễn
   */
  async remove(id: number): Promise<void> {
    // Xóa tất cả file references liên quan đến loại sản phẩm trước khi xóa
    await this.fileTrackingService.batchRemoveEntityFileReferences('ProductType', id);
    
    // Xóa vĩnh viễn loại sản phẩm
    await this.productTypeRepository.delete(id);
  }
}