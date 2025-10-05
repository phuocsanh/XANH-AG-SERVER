import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductSubtype, ProductSubtypeStatus } from '../../entities/product-subtypes.entity';
import { CreateProductSubtypeDto } from './dto/create-product-subtype.dto';
import { UpdateProductSubtypeDto } from './dto/update-product-subtype.dto';
import { FileTrackingService } from '../file-tracking/file-tracking.service';

/**
 * Service xử lý logic nghiệp vụ cho loại phụ sản phẩm
 * Cung cấp các chức năng CRUD và quản lý loại phụ sản phẩm với soft delete và status management
 */
@Injectable()
export class ProductSubtypeService {
  constructor(
    @InjectRepository(ProductSubtype)
    private productSubtypeRepository: Repository<ProductSubtype>,
    private fileTrackingService: FileTrackingService,
  ) {}

  /**
   * Tạo loại phụ sản phẩm mới
   * @param createProductSubtypeDto - Dữ liệu tạo loại phụ sản phẩm mới
   * @returns Thông tin loại phụ sản phẩm đã tạo
   */
  /**
   * Tạo mới loại phụ sản phẩm
   * @param createProductSubtypeDto - Dữ liệu tạo loại phụ sản phẩm
   * @returns Thông tin loại phụ sản phẩm đã tạo
   */
  async create(
    createProductSubtypeDto: CreateProductSubtypeDto,
  ): Promise<ProductSubtype> {
    const productSubtype = new ProductSubtype();
    Object.assign(productSubtype, createProductSubtypeDto);
    
    // Đặt giá trị mặc định cho status nếu không được cung cấp
    if (!productSubtype.status) {
      productSubtype.status = ProductSubtypeStatus.ACTIVE;
    }
    
    const savedProductSubtype =
      await this.productSubtypeRepository.save(productSubtype);
    return savedProductSubtype;
  }

  /**
   * Lấy danh sách tất cả loại phụ sản phẩm (chỉ những bản ghi chưa bị soft delete)
   * @param includeInactive - Có bao gồm các bản ghi inactive không (mặc định: false)
   * @returns Danh sách loại phụ sản phẩm
   */
  async findAll(includeInactive: boolean = false): Promise<ProductSubtype[]> {
    const queryBuilder = this.productSubtypeRepository.createQueryBuilder('productSubtype');
    
    // Loại bỏ các bản ghi đã bị soft delete
    queryBuilder.where('productSubtype.deletedAt IS NULL');
    
    if (!includeInactive) {
      queryBuilder.andWhere('productSubtype.status = :status', { 
        status: ProductSubtypeStatus.ACTIVE 
      });
    } else {
      queryBuilder.andWhere('productSubtype.status IN (:...statuses)', { 
        statuses: [ProductSubtypeStatus.ACTIVE, ProductSubtypeStatus.INACTIVE] 
      });
    }
    
    return queryBuilder.getMany();
  }

  /**
   * Lấy danh sách loại phụ sản phẩm theo loại sản phẩm (chỉ những bản ghi chưa bị soft delete)
   * @param productTypeId - ID của loại sản phẩm
   * @param includeInactive - Có bao gồm các bản ghi inactive không (mặc định: false)
   * @returns Danh sách loại phụ sản phẩm thuộc loại sản phẩm đó
   */
  async findByProductType(productTypeId: number, includeInactive: boolean = false): Promise<ProductSubtype[]> {
    const queryBuilder = this.productSubtypeRepository.createQueryBuilder('productSubtype')
      .where('productSubtype.productTypeId = :productTypeId', { productTypeId })
      .andWhere('productSubtype.deletedAt IS NULL');
    
    if (!includeInactive) {
      queryBuilder.andWhere('productSubtype.status = :status', { 
        status: ProductSubtypeStatus.ACTIVE 
      });
    } else {
      queryBuilder.andWhere('productSubtype.status IN (:...statuses)', { 
        statuses: [ProductSubtypeStatus.ACTIVE, ProductSubtypeStatus.INACTIVE] 
      });
    }
    
    return queryBuilder.getMany();
  }

  /**
   * Tìm loại phụ sản phẩm theo ID (bao gồm cả soft deleted nếu withDeleted = true)
   * @param id - ID của loại phụ sản phẩm cần tìm
   * @param withDeleted - Có bao gồm bản ghi đã bị soft delete không (mặc định: false)
   * @returns Thông tin loại phụ sản phẩm hoặc null nếu không tìm thấy
   */
  async findOne(id: number, withDeleted: boolean = false): Promise<ProductSubtype | null> {
    const queryBuilder = this.productSubtypeRepository.createQueryBuilder('productSubtype')
      .where('productSubtype.id = :id', { id });
    
    if (withDeleted) {
      queryBuilder.withDeleted();
    }
    
    return queryBuilder.getOne();
  }

  /**
   * Cập nhật thông tin loại phụ sản phẩm
   * @param id - ID của loại phụ sản phẩm cần cập nhật
   * @param updateProductSubtypeDto - Dữ liệu cập nhật loại phụ sản phẩm
   * @returns Thông tin loại phụ sản phẩm đã cập nhật
   */
  async update(
    id: number,
    updateProductSubtypeDto: UpdateProductSubtypeDto,
  ): Promise<ProductSubtype | null> {
    await this.productSubtypeRepository.update(id, updateProductSubtypeDto);
    return this.findOne(id);
  }

  /**
   * Kích hoạt loại phụ sản phẩm (chuyển status thành 'active')
   * @param id - ID của loại phụ sản phẩm cần kích hoạt
   * @returns Thông tin loại phụ sản phẩm đã kích hoạt
   */
  async activate(id: number): Promise<ProductSubtype | null> {
    await this.productSubtypeRepository.update(id, { 
      status: ProductSubtypeStatus.ACTIVE,
    });
    return this.findOne(id);
  }

  /**
   * Vô hiệu hóa loại phụ sản phẩm (chuyển status thành 'inactive')
   * @param id - ID của loại phụ sản phẩm cần vô hiệu hóa
   * @returns Thông tin loại phụ sản phẩm đã vô hiệu hóa
   */
  async deactivate(id: number): Promise<ProductSubtype | null> {
    await this.productSubtypeRepository.update(id, { 
      status: ProductSubtypeStatus.INACTIVE,
    });
    return this.findOne(id);
  }

  /**
   * Lưu trữ loại phụ sản phẩm (chuyển status thành 'archived')
   * @param id - ID của loại phụ sản phẩm cần lưu trữ
   * @returns Thông tin loại phụ sản phẩm đã lưu trữ
   */
  async archive(id: number): Promise<ProductSubtype | null> {
    await this.productSubtypeRepository.update(id, { 
      status: ProductSubtypeStatus.ARCHIVED,
    });
    return this.findOne(id);
  }

  /**
   * Soft delete loại phụ sản phẩm (đánh dấu deletedAt)
   * @param id - ID của loại phụ sản phẩm cần soft delete
   */
  async softRemove(id: number): Promise<void> {
    await this.productSubtypeRepository.softDelete(id);
  }

  /**
   * Khôi phục loại phụ sản phẩm đã bị soft delete
   * @param id - ID của loại phụ sản phẩm cần khôi phục
   * @returns Thông tin loại phụ sản phẩm đã khôi phục
   */
  async restore(id: number): Promise<ProductSubtype | null> {
    await this.productSubtypeRepository.restore(id);
    return this.findOne(id);
  }

  /**
   * Hard delete loại phụ sản phẩm (xóa vĩnh viễn khỏi database)
   * @param id - ID của loại phụ sản phẩm cần xóa vĩnh viễn
   */
  async remove(id: number): Promise<void> {
    // Xóa tất cả file references liên quan đến loại phụ sản phẩm trước khi xóa
    await this.fileTrackingService.batchRemoveEntityFileReferences('ProductSubtype', id);
    
    // Hard delete loại phụ sản phẩm
    await this.productSubtypeRepository.delete(id);
  }

  /**
   * Lấy danh sách loại phụ sản phẩm đã bị soft delete
   * @returns Danh sách loại phụ sản phẩm đã bị soft delete
   */
  async findDeleted(): Promise<ProductSubtype[]> {
    return this.productSubtypeRepository.createQueryBuilder('productSubtype')
      .withDeleted()
      .where('productSubtype.deletedAt IS NOT NULL')
      .getMany();
  }

  /**
   * Lấy danh sách loại phụ sản phẩm theo trạng thái (chỉ những bản ghi chưa bị soft delete)
   * @param status - Trạng thái cần lọc
   * @returns Danh sách loại phụ sản phẩm có trạng thái đó
   */
  async findByStatus(status: ProductSubtypeStatus): Promise<ProductSubtype[]> {
    const queryBuilder = this.productSubtypeRepository.createQueryBuilder('productSubtype')
      .where('productSubtype.status = :status', { status })
      .andWhere('productSubtype.deletedAt IS NULL');
    
    return queryBuilder.getMany();
  }
}