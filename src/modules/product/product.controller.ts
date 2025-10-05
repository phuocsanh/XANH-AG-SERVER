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
import { ProductStatus } from '../../entities/products.entity';

/**
 * Controller xử lý các request liên quan đến sản phẩm
 * Bao gồm quản lý sản phẩm, Status Management và Soft Delete
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
   * Lấy danh sách sản phẩm theo trạng thái
   * @param status - Trạng thái cần lọc (active, inactive, archived)
   * @returns Danh sách sản phẩm theo trạng thái
   */
  @Get('by-status/:status')
  findByStatus(@Param('status') status: ProductStatus) {
    return this.productService.findByStatus(status);
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
   * Kích hoạt sản phẩm (chuyển trạng thái thành active)
   * @param id - ID của sản phẩm cần kích hoạt
   * @returns Thông tin sản phẩm đã kích hoạt
   */
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.productService.activate(+id);
  }

  /**
   * Vô hiệu hóa sản phẩm (chuyển trạng thái thành inactive)
   * @param id - ID của sản phẩm cần vô hiệu hóa
   * @returns Thông tin sản phẩm đã vô hiệu hóa
   */
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.productService.deactivate(+id);
  }

  /**
   * Lưu trữ sản phẩm (chuyển trạng thái thành archived)
   * @param id - ID của sản phẩm cần lưu trữ
   * @returns Thông tin sản phẩm đã lưu trữ
   */
  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.productService.archive(+id);
  }

  /**
   * Soft delete sản phẩm
   * @param id - ID của sản phẩm cần soft delete
   */
  @Delete(':id/soft')
  softDelete(@Param('id') id: string) {
    return this.productService.softDelete(+id);
  }

  /**
   * Khôi phục sản phẩm đã bị soft delete
   * @param id - ID của sản phẩm cần khôi phục
   * @returns Thông tin sản phẩm đã khôi phục
   */
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.productService.restore(+id);
  }

  /**
   * Xóa cứng sản phẩm theo ID (hard delete)
   * @param id - ID của sản phẩm cần xóa
   * @returns Kết quả xóa sản phẩm
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(+id);
  }
}
