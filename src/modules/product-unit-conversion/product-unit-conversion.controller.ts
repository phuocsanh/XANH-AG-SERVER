import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductUnitConversionService } from './product-unit-conversion.service';
import {
  CreateProductUnitConversionDto,
  UpdateProductUnitConversionDto,
  SaveProductUnitConversionsDto,
} from './dto/create-product-unit-conversion.dto';

/**
 * Controller xử lý các request liên quan đến quy đổi đơn vị tính sản phẩm.
 * Base route: /product-unit-conversions
 */
@Controller('product-unit-conversions')
export class ProductUnitConversionController {
  constructor(private readonly service: ProductUnitConversionService) {}

  /**
   * Lấy tất cả quy đổi đơn vị của một sản phẩm.
   * GET /product-unit-conversions/product/:productId
   */
  @Get('product/:productId')
  findByProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.service.findByProduct(productId);
  }

  /**
   * Lấy đơn vị cơ sở của một sản phẩm.
   * GET /product-unit-conversions/product/:productId/base-unit
   */
  @Get('product/:productId/base-unit')
  getBaseUnit(@Param('productId', ParseIntPipe) productId: number) {
    return this.service.getBaseUnit(productId);
  }

  /**
   * Tạo mới một quy đổi đơn vị.
   * POST /product-unit-conversions
   */
  @Post()
  create(@Body() dto: CreateProductUnitConversionDto) {
    return this.service.create(dto);
  }

  /**
   * Lưu toàn bộ danh sách quy đổi cho 1 sản phẩm (xóa cũ, tạo mới).
   * Dùng khi save từ form sản phẩm.
   * POST /product-unit-conversions/product/:productId/save-all
   */
  @Post('product/:productId/save-all')
  @HttpCode(HttpStatus.OK)
  saveAllForProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: SaveProductUnitConversionsDto,
  ) {
    return this.service.saveAllForProduct(productId, dto.items);
  }

  /**
   * Cập nhật một quy đổi đơn vị theo ID.
   * PUT /product-unit-conversions/:id
   */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductUnitConversionDto,
  ) {
    return this.service.update(id, dto);
  }

  /**
   * Xóa một quy đổi đơn vị theo ID.
   * DELETE /product-unit-conversions/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
