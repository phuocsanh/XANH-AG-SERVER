import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

/**
 * Controller xử lý các request liên quan đến sản phẩm
 * Bao gồm quản lý sản phẩm, loại sản phẩm, loại phụ sản phẩm và mối quan hệ giữa chúng
 */
@Controller('products')
// @UseGuards(JwtAuthGuard) // Tạm thời comment để test
export class ProductController {
  /**
   * Constructor injection ProductService
   * @param productService - Service xử lý logic nghiệp vụ sản phẩm
   */
  constructor(private readonly productService: ProductService) {}

  /**
   * Tạo sản phẩm mới
   * @param createProductDto - Dữ liệu tạo sản phẩm mới
   * @returns Thông tin sản phẩm đã tạo
   */
  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  /**
   * Endpoint test để kiểm tra chuyển đổi ngày tháng
   * @param testData - Dữ liệu test chứa ngày tháng
   * @returns Thông tin về việc chuyển đổi ngày tháng
   */
  @Post('test-date')
  testDate(@Body() testData: any) {
    console.log('Test Date DTO:', testData);
    console.log('myDate type:', typeof testData.myDate);
    console.log('myDate instanceof Date:', testData.myDate instanceof Date);
    return { success: true, data: testData };
  }

  /**
   * Lấy danh sách tất cả sản phẩm
   * @returns Danh sách sản phẩm
   */
  @Get()
  findAll() {
    return this.productService.findAll();
  }

  /**
   * Tìm kiếm sản phẩm theo từ khóa
   * @param query - Từ khóa tìm kiếm
   * @returns Danh sách sản phẩm phù hợp
   */
  @Get('search')
  search(@Query('q') query: string) {
    return this.productService.searchProducts(query);
  }

  /**
   * Lấy thông tin chi tiết một sản phẩm theo ID
   * @param id - ID của sản phẩm cần tìm
   * @returns Thông tin sản phẩm
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(+id);
  }

  /**
   * Cập nhật thông tin sản phẩm
   * @param id - ID của sản phẩm cần cập nhật
   * @param updateProductDto - Dữ liệu cập nhật sản phẩm
   * @returns Thông tin sản phẩm đã cập nhật
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(+id, updateProductDto);
  }

  /**
   * Xóa sản phẩm theo ID
   * @param id - ID của sản phẩm cần xóa
   * @returns Kết quả xóa sản phẩm
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(+id);
  }
}
