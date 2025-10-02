import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ProductTypeService } from './product-type.service';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';

/**
 * Controller xử lý các request liên quan đến loại sản phẩm
 * Bao gồm các thao tác CRUD cho ProductType
 */
@Controller('product-types')
// @UseGuards(JwtAuthGuard) // Tạm thời comment để test
export class ProductTypeController {
  /**
   * Constructor injection ProductTypeService
   * @param productTypeService - Service xử lý logic nghiệp vụ loại sản phẩm
   */
  constructor(private readonly productTypeService: ProductTypeService) {}

  /**
   * Tạo loại sản phẩm mới
   * @param createProductTypeDto - Dữ liệu tạo loại sản phẩm mới
   * @returns Thông tin loại sản phẩm đã tạo
   */
  @Post()
  create(@Body() createProductTypeDto: CreateProductTypeDto) {
    return this.productTypeService.create(createProductTypeDto);
  }

  /**
   * Lấy danh sách tất cả loại sản phẩm
   * @returns Danh sách loại sản phẩm
   */
  @Get()
  findAll() {
    return this.productTypeService.findAll();
  }

  /**
   * Lấy thông tin chi tiết một loại sản phẩm theo ID
   * @param id - ID của loại sản phẩm cần tìm
   * @returns Thông tin loại sản phẩm
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productTypeService.findOne(+id);
  }

  /**
   * Cập nhật thông tin loại sản phẩm
   * @param id - ID của loại sản phẩm cần cập nhật
   * @param updateProductTypeDto - Dữ liệu cập nhật loại sản phẩm
   * @returns Thông tin loại sản phẩm đã cập nhật
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProductTypeDto: UpdateProductTypeDto,
  ) {
    return this.productTypeService.update(+id, updateProductTypeDto);
  }

  /**
   * Xóa loại sản phẩm theo ID
   * @param id - ID của loại sản phẩm cần xóa
   * @returns Kết quả xóa loại sản phẩm
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productTypeService.remove(+id);
  }
}