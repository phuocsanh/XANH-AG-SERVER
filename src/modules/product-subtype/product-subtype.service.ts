import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductSubtype } from '../../entities/product-subtypes.entity';
import { CreateProductSubtypeDto } from './dto/create-product-subtype.dto';
import { UpdateProductSubtypeDto } from './dto/update-product-subtype.dto';
import { FileTrackingService } from '../file-tracking/file-tracking.service';

/**
 * Service xử lý logic nghiệp vụ cho loại phụ sản phẩm
 * Cung cấp các chức năng CRUD và quản lý loại phụ sản phẩm
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
  async create(
    createProductSubtypeDto: CreateProductSubtypeDto,
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
  async findAll(): Promise<ProductSubtype[]> {
    return this.productSubtypeRepository.find();
  }

  /**
   * Lấy danh sách loại phụ sản phẩm theo loại sản phẩm
   * @param productTypeId - ID của loại sản phẩm
   * @returns Danh sách loại phụ sản phẩm thuộc loại sản phẩm đó
   */
  async findByProductType(productTypeId: number): Promise<ProductSubtype[]> {
    return this.productSubtypeRepository.find({ where: { productTypeId } });
  }

  /**
   * Tìm loại phụ sản phẩm theo ID
   * @param id - ID của loại phụ sản phẩm cần tìm
   * @returns Thông tin loại phụ sản phẩm hoặc null nếu không tìm thấy
   */
  async findOne(id: number): Promise<ProductSubtype | null> {
    return this.productSubtypeRepository.findOne({ where: { id } });
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
   * Xóa loại phụ sản phẩm theo ID
   * @param id - ID của loại phụ sản phẩm cần xóa
   */
  async remove(id: number): Promise<void> {
    // Xóa tất cả file references liên quan đến loại phụ sản phẩm trước khi xóa
    await this.fileTrackingService.batchRemoveEntityFileReferences('ProductSubtype', id);
    
    // Xóa loại phụ sản phẩm
    await this.productSubtypeRepository.delete(id);
  }
}