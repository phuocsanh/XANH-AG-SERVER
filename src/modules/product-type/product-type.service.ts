import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductType } from '../../entities/product-types.entity';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';
import { FileTrackingService } from '../file-tracking/file-tracking.service';

/**
 * Service xử lý logic nghiệp vụ liên quan đến loại sản phẩm
 * Bao gồm các thao tác CRUD cho ProductType
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
   * Lấy danh sách tất cả loại sản phẩm
   * @returns Danh sách loại sản phẩm
   */
  async findAll(): Promise<ProductType[]> {
    return this.productTypeRepository.find();
  }

  /**
   * Tìm loại sản phẩm theo ID
   * @param id - ID của loại sản phẩm cần tìm
   * @returns Thông tin loại sản phẩm hoặc null nếu không tìm thấy
   */
  async findOne(id: number): Promise<ProductType | null> {
    return this.productTypeRepository.findOne({ where: { id } });
  }

  /**
   * Cập nhật thông tin loại sản phẩm
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
   * Xóa loại sản phẩm theo ID
   * @param id - ID của loại sản phẩm cần xóa
   */
  async remove(id: number): Promise<void> {
    // Xóa tất cả file references liên quan đến loại sản phẩm trước khi xóa
    await this.fileTrackingService.batchRemoveEntityFileReferences('ProductType', id);
    
    // Xóa loại sản phẩm
    await this.productTypeRepository.delete(id);
  }
}