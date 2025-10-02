import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ProductSubtypeService } from './product-subtype.service';
import { CreateProductSubtypeDto } from './dto/create-product-subtype.dto';
import { UpdateProductSubtypeDto } from './dto/update-product-subtype.dto';

/**
 * Controller xử lý các request liên quan đến loại phụ sản phẩm
 * Cung cấp các endpoint CRUD cho quản lý loại phụ sản phẩm
 */
@Controller('product-subtype')
// @UseGuards(JwtAuthGuard) // Tạm thời comment để test
export class ProductSubtypeController {
  /**
   * Constructor injection ProductSubtypeService
   * @param productSubtypeService - Service xử lý logic nghiệp vụ loại phụ sản phẩm
   */
  constructor(private readonly productSubtypeService: ProductSubtypeService) {}

  /**
   * Tạo loại phụ sản phẩm mới
   * @param createProductSubtypeDto - Dữ liệu tạo loại phụ sản phẩm mới
   * @returns Thông tin loại phụ sản phẩm đã tạo
   */
  @Post()
  create(@Body() createProductSubtypeDto: CreateProductSubtypeDto) {
    return this.productSubtypeService.create(createProductSubtypeDto);
  }

  /**
   * Lấy danh sách tất cả loại phụ sản phẩm
   * @returns Danh sách loại phụ sản phẩm
   */
  @Get()
  findAll() {
    return this.productSubtypeService.findAll();
  }

  /**
   * Lấy thông tin chi tiết một loại phụ sản phẩm theo ID
   * @param id - ID của loại phụ sản phẩm cần tìm
   * @returns Thông tin loại phụ sản phẩm
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productSubtypeService.findOne(+id);
  }

  /**
   * Lấy danh sách loại phụ sản phẩm theo loại sản phẩm
   * @param productTypeId - ID của loại sản phẩm
   * @returns Danh sách loại phụ sản phẩm thuộc loại sản phẩm đó
   */
  @Get('by-product-type/:productTypeId')
  findByProductType(@Param('productTypeId') productTypeId: string) {
    return this.productSubtypeService.findByProductType(+productTypeId);
  }

  /**
   * Cập nhật thông tin loại phụ sản phẩm
   * @param id - ID của loại phụ sản phẩm cần cập nhật
   * @param updateProductSubtypeDto - Dữ liệu cập nhật loại phụ sản phẩm
   * @returns Thông tin loại phụ sản phẩm đã cập nhật
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProductSubtypeDto: UpdateProductSubtypeDto,
  ) {
    return this.productSubtypeService.update(+id, updateProductSubtypeDto);
  }

  /**
   * Xóa loại phụ sản phẩm theo ID
   * @param id - ID của loại phụ sản phẩm cần xóa
   * @returns Kết quả xóa loại phụ sản phẩm
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productSubtypeService.remove(+id);
  }
}